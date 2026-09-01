"""Transport-layer audio plumbing for voice calls — provider-agnostic.

Everything here deals in PCM s16 mono. The outgoing track paces itself in
real time and synthesizes silence when its queue is empty, so it never
stalls the peer connection regardless of how bursty the STT->LLM->TTS
pipeline behind it is.
"""

import asyncio
import fractions
import time
from collections.abc import AsyncIterator

import av
import numpy as np
import structlog
from aiortc import MediaStreamTrack

logger = structlog.get_logger()

SAMPLE_RATE = 48000
FRAME_MS = 20
SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_MS // 1000  # 960
TIME_BASE = fractions.Fraction(1, SAMPLE_RATE)

STT_SAMPLE_RATE = 16000  # Sarvam Saarika's expected input rate


def _valid_pcm(frame: av.AudioFrame) -> bytes:
    """`bytes(frame.planes[0])` returns the plane's whole underlying buffer,
    which libav over-allocates for alignment — confirmed live, a resampled
    frame reporting 320 valid samples had a 384-sample plane buffer, with
    the trailing 64 samples being leftover/uninitialized memory, not
    silence. Feeding that straight into an RMS or byte-length calculation
    corrupts it with garbage that looks like noise or speech. Slicing to
    exactly frame.samples is the only safe way to read real audio out of a
    plane (mono s16 = 2 bytes/sample)."""
    return bytes(frame.planes[0])[: frame.samples * 2]


def _silence_frame() -> av.AudioFrame:
    frame = av.AudioFrame(format="s16", layout="mono", samples=SAMPLES_PER_FRAME)
    for plane in frame.planes:
        plane.update(bytes(plane.buffer_size))
    frame.sample_rate = SAMPLE_RATE
    return frame


def resample_to_track_format(pcm: bytes, sample_rate: int) -> list[av.AudioFrame]:
    """Splits raw s16 mono PCM at `sample_rate` into SAMPLES_PER_FRAME-sized
    av.AudioFrames at SAMPLE_RATE (resampling first if needed). Every audio
    source feeding the outgoing track — TTS output, the echo-back path, the
    "not configured" tone — funnels through this one function so there's a
    single place that matches whatever format the track actually needs."""
    samples = np.frombuffer(pcm, dtype=np.int16)
    if samples.size == 0:
        return []

    if sample_rate != SAMPLE_RATE:
        source = av.AudioFrame(format="s16", layout="mono", samples=samples.size)
        source.planes[0].update(samples.tobytes())
        source.sample_rate = sample_rate
        resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
        resampled_frames = resampler.resample(source)
        combined = (
            np.concatenate([np.frombuffer(_valid_pcm(f), dtype=np.int16) for f in resampled_frames])
            if resampled_frames
            else np.array([], dtype=np.int16)
        )
    else:
        combined = samples

    out: list[av.AudioFrame] = []
    for start in range(0, combined.size, SAMPLES_PER_FRAME):
        chunk = combined[start : start + SAMPLES_PER_FRAME]
        if chunk.size < SAMPLES_PER_FRAME:
            chunk = np.pad(chunk, (0, SAMPLES_PER_FRAME - chunk.size))
        frame = av.AudioFrame(format="s16", layout="mono", samples=SAMPLES_PER_FRAME)
        frame.planes[0].update(chunk.astype(np.int16).tobytes())
        frame.sample_rate = SAMPLE_RATE
        out.append(frame)
    return out


def resample_frame_to_track_format(frame: av.AudioFrame) -> list[av.AudioFrame]:
    """Same as `resample_to_track_format`, starting from an already-decoded
    incoming frame — used by the echo fallback path in pipeline.py."""
    pcm = _valid_pcm(frame)
    return resample_to_track_format(pcm, frame.sample_rate)


def generate_tone_frames(duration_s: float = 0.6, freq_hz: float = 440.0) -> list[av.AudioFrame]:
    """A short sine-wave beep — no external asset file needed for the
    "voice provider not configured" signal."""
    n = int(SAMPLE_RATE * duration_s)
    t = np.arange(n) / SAMPLE_RATE
    wave = (np.sin(2 * np.pi * freq_hz * t) * 0.2 * 32767).astype(np.int16)
    return resample_to_track_format(wave.tobytes(), SAMPLE_RATE)


class AudioQueueTrack(MediaStreamTrack):
    """An outgoing WebRTC audio track backed by a frame queue. `enqueue_frames`
    is how the pipeline (echo, tone, or real TTS output) feeds it; `recv()`
    (called by aiortc internally) paces playback in real time and emits
    silence when the queue runs dry rather than blocking the connection."""

    kind = "audio"

    def __init__(self) -> None:
        super().__init__()
        self._queue: asyncio.Queue[av.AudioFrame] = asyncio.Queue()
        self._pts = 0
        self._start_time: float | None = None

    async def enqueue_frames(self, frames: list[av.AudioFrame]) -> None:
        for frame in frames:
            await self._queue.put(frame)

    async def wait_until_drained(self, extra_settle_s: float = 0.3) -> None:
        """Blocks until every frame handed to enqueue_frames() has actually
        been pulled by recv() (i.e., really played out, not just queued —
        recv() paces itself in real time), plus a small settle margin for
        network/jitter-buffer/speaker latency on the peer's end. Used by
        pipeline.py to know when it's safe to stop muting the mic — see
        AudioFrameBuffer.muted's docstring for why muting during our own
        playback matters at all."""
        while not self._queue.empty():
            await asyncio.sleep(0.05)
        await asyncio.sleep(extra_settle_s)

    async def recv(self) -> av.AudioFrame:
        if self._start_time is None:
            self._start_time = time.time()

        # Real-time pacing: don't hand aiortc frames faster than they'll
        # actually be played, or the receiver's jitter buffer overflows.
        target_time = self._start_time + (self._pts / SAMPLE_RATE)
        now = time.time()
        if target_time > now:
            await asyncio.sleep(target_time - now)

        try:
            frame = self._queue.get_nowait()
        except asyncio.QueueEmpty:
            frame = _silence_frame()

        frame.pts = self._pts
        frame.time_base = TIME_BASE
        self._pts += SAMPLES_PER_FRAME
        return frame


class AudioFrameBuffer:
    """Consumes an incoming track's frames, resamples to 16kHz mono s16 PCM
    (Sarvam Saarika's expected input), and segments it into utterances via
    adaptive RMS-energy silence detection.

    A single fixed RMS threshold doesn't survive a real room: confirmed
    live, a laptop mic's own ambient/hum floor sat at a near-constant
    ~3710 RMS for an entire call — comfortably above a naive fixed
    threshold like 500 — so the old code saw "someone's talking"
    permanently, silence_ms never accumulated, and no utterance ever
    closed (nothing was ever sent to STT, regardless of what was actually
    said). Fixed instead by calibrating a per-call noise floor from the
    first CALIBRATION_MS of audio (assumed silence — the caller hasn't
    started talking the instant the call connects) and requiring speech to
    clear that floor by SPEECH_MARGIN, not just an absolute number.
    """

    MIN_SPEECH_RMS = 500  # absolute floor — never call anything quieter than this "speech", even in a dead-silent room
    SPEECH_MARGIN = 2.5  # speech must be at least this many times louder than the calibrated ambient floor
    NOISE_FLOOR_SMOOTHING = 0.05  # how fast the floor re-adapts after calibration (per ambient frame)
    CALIBRATION_MS = 500  # initial window treated as pure ambient noise, not scanned for speech at all
    SILENCE_HANGOVER_MS = 600  # trailing silence before an utterance is "done"
    MIN_UTTERANCE_MS = 300  # reject noise blips shorter than this

    def __init__(self) -> None:
        self._resampler = av.AudioResampler(format="s16", layout="mono", rate=STT_SAMPLE_RATE)
        # Set by pipeline.py around each TTS playback (via
        # AudioQueueTrack.wait_until_drained() to know when to clear it).
        # Without this, the mic keeps listening while our own reply plays
        # out of the peer's speakers — on any setup without headphones,
        # that reply bleeds back into the mic. Best case it just corrupts
        # the ambient noise floor; worst case (confirmed live) it reads as
        # continuous "someone's talking" that never goes silent, so no
        # further utterance ever closes for the rest of the call. Muting
        # is the standard half-duplex simplification for this — it means
        # the agent can't be interrupted mid-sentence, which is an
        # accepted tradeoff, not an oversight.
        self.muted = False

    async def utterances(self, track: MediaStreamTrack) -> AsyncIterator[bytes]:
        buffer = bytearray()
        speaking = False
        silence_ms = 0.0
        noise_floor = 0.0
        calibrated_ms = 0.0
        calibration_samples: list[float] = []

        while True:
            try:
                frame = await track.recv()
            except Exception:  # noqa: BLE001 - track ended (peer hung up, connection dropped)
                break

            if self.muted:
                # Discard rather than buffer — and drop any in-progress
                # utterance outright, since it's now stale: whatever was
                # being said is either already covered by the utterance
                # that triggered this reply, or got cut off by the agent
                # starting to talk, either way not worth stitching to
                # whatever comes after we unmute.
                if speaking:
                    buffer = bytearray()
                    speaking = False
                    silence_ms = 0.0
                continue

            for resampled in self._resampler.resample(frame):
                pcm = _valid_pcm(resampled)
                samples = np.frombuffer(pcm, dtype=np.int16)
                if samples.size == 0:
                    continue
                rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
                frame_ms = (samples.size / STT_SAMPLE_RATE) * 1000

                if calibrated_ms < self.CALIBRATION_MS:
                    calibration_samples.append(rms)
                    calibrated_ms += frame_ms
                    if calibrated_ms >= self.CALIBRATION_MS:
                        noise_floor = float(np.mean(calibration_samples))
                        logger.info("voice_call_noise_floor_calibrated", noise_floor=noise_floor)
                    continue  # don't classify speech vs. silence until calibrated

                is_speech = rms >= max(self.MIN_SPEECH_RMS, noise_floor * self.SPEECH_MARGIN)

                if is_speech:
                    speaking = True
                    silence_ms = 0.0
                    buffer.extend(pcm)
                elif speaking:
                    silence_ms += frame_ms
                    buffer.extend(pcm)
                    if silence_ms >= self.SILENCE_HANGOVER_MS:
                        utterance_ms = (len(buffer) / 2 / STT_SAMPLE_RATE) * 1000
                        if utterance_ms >= self.MIN_UTTERANCE_MS:
                            logger.info(
                                "voice_call_utterance_detected",
                                utterance_ms=utterance_ms, noise_floor=noise_floor,
                            )
                            yield bytes(buffer)
                        buffer = bytearray()
                        speaking = False
                        silence_ms = 0.0
                        # The utterance that just ended proves the room is
                        # quiet again right now — snap the floor back to it
                        # instead of waiting for the slow EMA below to
                        # climb back down on its own.
                        noise_floor = rms
                else:
                    # Ambient (non-speech) frame — slowly track the room's
                    # baseline so it can drift with real conditions (an AC
                    # kicking in, a door closing) over a long call.
                    noise_floor = (
                        noise_floor * (1 - self.NOISE_FLOOR_SMOOTHING)
                        + rms * self.NOISE_FLOOR_SMOOTHING
                    )
