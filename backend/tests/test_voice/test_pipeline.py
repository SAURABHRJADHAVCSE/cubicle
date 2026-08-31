"""Integration-level coverage for CallAudioPipeline._run_turns — the actual
reported bug ("after I speak once it never responds again") lived in the
concurrency wiring between the continuous mic-reading loop and per-turn
STT->LLM->TTS processing, not just in AudioFrameBuffer's own detection
logic (see test_audio.py for that). This drives _run_turns end-to-end
against two separate simulated utterances and asserts both actually
produce a transcript + reply, proving the pipeline keeps listening after
the first turn instead of getting stuck.
"""

import av
import numpy as np
import pytest

from app.models.agent import Agent
from app.voice import pipeline as pipeline_module
from app.voice.audio import SAMPLE_RATE
from app.voice.pipeline import CallAudioPipeline

FRAME_MS = 20
SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_MS // 1000


def _frame(amplitude: int) -> av.AudioFrame:
    frame = av.AudioFrame(format="s16", layout="mono", samples=SAMPLES_PER_FRAME)
    samples = np.full(SAMPLES_PER_FRAME, amplitude, dtype=np.int16)
    frame.planes[0].update(samples.tobytes())
    frame.sample_rate = SAMPLE_RATE
    return frame


def _ms_of_frames(amplitude: int, ms: int) -> list[av.AudioFrame]:
    return [_frame(amplitude) for _ in range(ms // FRAME_MS)]


class _FakeIncomingTrack:
    def __init__(self, frames: list[av.AudioFrame]) -> None:
        self._frames = iter(frames)

    async def recv(self) -> av.AudioFrame:
        try:
            return next(self._frames)
        except StopIteration:
            raise RuntimeError("track ended") from None


class _FakeOutgoingTrack:
    """Just enough of AudioQueueTrack's surface for _handle_utterance's TTS
    phase to run — enqueue_frames + wait_until_drained, no real pacing."""

    def __init__(self) -> None:
        self.enqueued: list[int] = []

    async def enqueue_frames(self, frames: list) -> None:
        self.enqueued.append(len(frames))

    async def wait_until_drained(self, extra_settle_s: float = 0.0) -> None:
        return None


class _StubSTT:
    def __init__(self, transcripts: list[str]) -> None:
        self._transcripts = iter(transcripts)

    def is_configured(self) -> bool:
        return True

    async def transcribe(self, pcm: bytes, language: str = "unknown") -> str:
        return next(self._transcripts, "")


class _StubTTS:
    def is_configured(self) -> bool:
        return True

    async def synthesize(self, text: str, language: str, gender: str, pace: str):
        return bytes(3200), 16000  # ~100ms of silence at 16kHz — just needs to be non-empty


class _StubEngine:
    async def chat(self, message: str, history: list[dict]) -> str:
        return f"reply to: {message}"


def _agent() -> Agent:
    return Agent(
        name="Jarvis", role="Assistant", engine_type="api", engine_provider="anthropic",
        personality_traits=[],
    )


async def test_run_turns_handles_two_separate_utterances(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(pipeline_module, "get_engine", lambda agent: _StubEngine())

    transcripts: list[tuple[str, str]] = []

    async def emit_transcript(role: str, text: str) -> None:
        transcripts.append((role, text))

    async def emit_status(message: str) -> None:
        pass

    outgoing = _FakeOutgoingTrack()
    pipeline = CallAudioPipeline(
        agent=_agent(), outgoing=outgoing, emit_status=emit_status, emit_transcript=emit_transcript
    )
    pipeline.stt = _StubSTT(["hey jarvis", "what's the weather"])
    pipeline.tts = _StubTTS()

    # Two separate loud-then-silent segments — AudioFrameBuffer's real
    # detection logic (calibration + adaptive threshold + hangover) turns
    # this into exactly two utterances, same as a real two-turn
    # conversation would.
    frames = [
        *_ms_of_frames(50, 600),  # calibration
        *_ms_of_frames(50, 400),  # quiet lead-in
        *_ms_of_frames(20000, 500),  # utterance 1
        *_ms_of_frames(50, 700),  # closes utterance 1 (hangover)
        *_ms_of_frames(20000, 500),  # utterance 2
        *_ms_of_frames(50, 700),  # closes utterance 2 (hangover)
    ]

    await pipeline._run_turns(_FakeIncomingTrack(frames))

    assert transcripts == [
        ("user", "hey jarvis"),
        ("agent", "reply to: hey jarvis"),
        ("user", "what's the weather"),
        ("agent", "reply to: what's the weather"),
    ]
    # Both replies actually got synthesized and sent out, not dropped.
    assert len(outgoing.enqueued) == 2
