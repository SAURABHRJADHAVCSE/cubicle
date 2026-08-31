"""Tests for AudioFrameBuffer's adaptive speech/silence detection.

Regression coverage for the live bug this was built to fix: a fixed
absolute RMS threshold doesn't survive a real room's ambient noise floor —
confirmed live, a laptop mic's own hum sat at a near-constant ~3710 RMS for
an entire call, comfortably above the old fixed threshold of 500, so no
utterance ever closed and nothing was ever sent to STT.
"""

import asyncio

import av
import numpy as np

from app.voice.audio import SAMPLE_RATE, AudioFrameBuffer, AudioQueueTrack

FRAME_MS = 20
SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_MS // 1000


def _frame(amplitude: int) -> av.AudioFrame:
    """A 20ms 48kHz mono s16 frame of constant amplitude — RMS of a
    constant signal is just its own magnitude, so this gives a fully
    deterministic, reproducible RMS level for each test frame."""
    frame = av.AudioFrame(format="s16", layout="mono", samples=SAMPLES_PER_FRAME)
    samples = np.full(SAMPLES_PER_FRAME, amplitude, dtype=np.int16)
    frame.planes[0].update(samples.tobytes())
    frame.sample_rate = SAMPLE_RATE
    return frame


class _FakeTrack:
    """Feeds a fixed sequence of frames, then ends the "track" — mirrors
    how a real aiortc MediaStreamTrack's .recv() raises once the peer
    hangs up (caught as the loop-ending condition in utterances())."""

    def __init__(self, frames: list[av.AudioFrame]) -> None:
        self._frames = iter(frames)

    async def recv(self) -> av.AudioFrame:
        try:
            return next(self._frames)
        except StopIteration:
            raise RuntimeError("track ended") from None


def _ms_of_frames(amplitude: int, ms: int) -> list[av.AudioFrame]:
    return [_frame(amplitude) for _ in range(ms // FRAME_MS)]


async def _collect(frames: list[av.AudioFrame]) -> list[bytes]:
    buf = AudioFrameBuffer()
    track = _FakeTrack(frames)
    return [utt async for utt in buf.utterances(track)]


async def test_constant_ambient_noise_never_yields_an_utterance() -> None:
    # The exact regression: a call that's noisy but nobody ever actually
    # speaks (ambient noise above the old fixed threshold, but never
    # louder than itself) must never fire an utterance.
    frames = _ms_of_frames(3710, 4000)  # 4s of constant ~3710 RMS "hum"
    assert await _collect(frames) == []


async def test_loud_burst_after_calibration_yields_one_utterance() -> None:
    frames = [
        *_ms_of_frames(200, 500),  # calibration window: quiet room
        *_ms_of_frames(200, 300),  # still-quiet lead-in, past calibration
        *_ms_of_frames(8000, 500),  # a clearly-louder "utterance"
        *_ms_of_frames(200, 700),  # trailing silence, past the 600ms hangover
    ]
    utterances = await _collect(frames)
    assert len(utterances) == 1
    # The buffered utterance includes the spoken portion plus the trailing
    # hangover silence that closed it (~500ms + ~600ms) — just sanity-check
    # it's a real, non-trivial chunk of 16kHz 16-bit mono PCM, not pin the
    # exact byte count.
    assert 16000 * 2 < len(utterances[0]) < 16000 * 4


async def test_muted_frames_are_discarded_and_resume_detects_afterward() -> None:
    """Regression coverage for the "after I speak once it never responds
    again" report — the mic must not treat the agent's own TTS reply
    (played back through the peer's speakers with no headphones) as more
    user speech. AudioFrameBuffer.muted is how pipeline.py achieves that;
    this pins the actual discard behavior (no utterance while muted, no
    stale partial utterance leaking through) independent of the
    concurrency plumbing in pipeline.py that toggles it."""
    buf = AudioFrameBuffer()

    class _TrackWithMutePoint:
        """Flips `buf.muted` on once a specific frame count is reached —
        stands in for pipeline.py setting it mid-call, without needing the
        real producer/consumer concurrency to exercise this class's own
        per-frame discard logic in isolation."""

        def __init__(self, frames: list[av.AudioFrame], mute_at_frame: int) -> None:
            self._frames = iter(frames)
            self._count = 0
            self._mute_at_frame = mute_at_frame

        async def recv(self) -> av.AudioFrame:
            self._count += 1
            if self._count == self._mute_at_frame:
                buf.muted = True
            try:
                return next(self._frames)
            except StopIteration:
                raise RuntimeError("track ended") from None

    calibration_frames = 500 // FRAME_MS
    lead_in_frames = 300 // FRAME_MS
    frames = [
        *_ms_of_frames(200, 500),  # calibration
        *_ms_of_frames(200, 300),  # quiet lead-in
        *_ms_of_frames(8000, 500),  # a loud burst — but muted kicks in partway through
        *_ms_of_frames(200, 700),  # trailing silence
    ]
    # Mute a few frames into the loud burst — simulates the agent starting
    # to talk right as it starts processing a just-detected utterance.
    mute_at_frame = calibration_frames + lead_in_frames + 3

    utterances = [
        utt async for utt in buf.utterances(_TrackWithMutePoint(frames, mute_at_frame))
    ]

    assert utterances == []
    assert buf.muted is True  # nothing in this class unmutes on its own — that's pipeline.py's job


async def test_detection_resumes_correctly_after_unmuting() -> None:
    buf = AudioFrameBuffer()
    buf.muted = True

    class _TrackThatUnmutesAfter:
        def __init__(self, frames: list[av.AudioFrame], unmute_at_frame: int) -> None:
            self._frames = iter(frames)
            self._count = 0
            self._unmute_at_frame = unmute_at_frame

        async def recv(self) -> av.AudioFrame:
            self._count += 1
            if self._count == self._unmute_at_frame:
                buf.muted = False
            try:
                return next(self._frames)
            except StopIteration:
                raise RuntimeError("track ended") from None

    frames = [
        *_ms_of_frames(8000, 1000),  # would look like speech, but starts muted
        *_ms_of_frames(200, 500),  # calibration, once unmuted
        *_ms_of_frames(200, 300),  # quiet lead-in
        *_ms_of_frames(8000, 500),  # a real burst, after unmuting
        *_ms_of_frames(200, 700),  # trailing silence
    ]
    unmute_at_frame = 1000 // FRAME_MS + 1

    utterances = [
        utt async for utt in buf.utterances(_TrackThatUnmutesAfter(frames, unmute_at_frame))
    ]

    assert len(utterances) == 1


async def test_wait_until_drained_returns_immediately_for_an_empty_queue() -> None:
    track = AudioQueueTrack()
    # No enqueue_frames() call at all — should not hang waiting on
    # anything that was never going to arrive.
    await asyncio.wait_for(track.wait_until_drained(extra_settle_s=0.01), timeout=1.0)


async def test_wait_until_drained_waits_for_recv_to_pull_everything() -> None:
    track = AudioQueueTrack()
    await track.enqueue_frames([_frame(100), _frame(100)])

    drained = asyncio.Event()

    async def _wait() -> None:
        await track.wait_until_drained(extra_settle_s=0.01)
        drained.set()

    waiter = asyncio.create_task(_wait())
    await asyncio.sleep(0.05)
    assert not drained.is_set()  # still 2 frames sitting in the queue

    # recv() paces itself in real time via _pts/_start_time, but that
    # pacing is relative to when recv() was first called on this instance
    # — calling it now just drains the queue immediately, since nothing
    # else has been calling it yet to establish a slower cadence.
    await track.recv()
    await track.recv()

    await asyncio.wait_for(waiter, timeout=1.0)
    assert drained.is_set()


async def test_noisy_room_still_detects_speech_clearly_above_the_floor() -> None:
    # The old bug's exact scenario, but with real speech thrown in: even
    # with a noise floor near the old fixed threshold, a burst well above
    # SPEECH_MARGIN times that floor must still register.
    frames = [
        *_ms_of_frames(3710, 500),  # calibrates the floor to the noisy level
        *_ms_of_frames(3710, 300),
        *_ms_of_frames(15000, 500),  # clearly louder than 2.5x the floor
        *_ms_of_frames(3710, 700),
    ]
    assert len(await _collect(frames)) == 1
