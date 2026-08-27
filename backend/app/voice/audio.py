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
from aiortc import MediaStreamTrack

SAMPLE_RATE = 48000
FRAME_MS = 20
SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_MS // 1000  # 960
TIME_BASE = fractions.Fraction(1, SAMPLE_RATE)

STT_SAMPLE_RATE = 16000  # Sarvam Saarika's expected input rate


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
            np.concatenate([np.frombuffer(bytes(f.planes[0]), dtype=np.int16) for f in resampled_frames])
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
    pcm = bytes(frame.planes[0])
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
    simple RMS-energy silence detection."""

    SPEECH_RMS_THRESHOLD = 500  # empirical s16 RMS floor for "someone's talking"
    SILENCE_HANGOVER_MS = 600  # trailing silence before an utterance is "done"
    MIN_UTTERANCE_MS = 300  # reject noise blips shorter than this

    def __init__(self) -> None:
        self._resampler = av.AudioResampler(format="s16", layout="mono", rate=STT_SAMPLE_RATE)

    async def utterances(self, track: MediaStreamTrack) -> AsyncIterator[bytes]:
        buffer = bytearray()
        speaking = False
        silence_ms = 0.0

        while True:
            try:
                frame = await track.recv()
            except Exception:  # noqa: BLE001 - track ended (peer hung up, connection dropped)
                break

            for resampled in self._resampler.resample(frame):
                pcm = bytes(resampled.planes[0])
                samples = np.frombuffer(pcm, dtype=np.int16)
                if samples.size == 0:
                    continue
                rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
                frame_ms = (samples.size / STT_SAMPLE_RATE) * 1000

                if rms >= self.SPEECH_RMS_THRESHOLD:
                    speaking = True
                    silence_ms = 0.0
                    buffer.extend(pcm)
                elif speaking:
                    silence_ms += frame_ms
                    buffer.extend(pcm)
                    if silence_ms >= self.SILENCE_HANGOVER_MS:
                        utterance_ms = (len(buffer) / 2 / STT_SAMPLE_RATE) * 1000
                        if utterance_ms >= self.MIN_UTTERANCE_MS:
                            yield bytes(buffer)
                        buffer = bytearray()
                        speaking = False
                        silence_ms = 0.0
