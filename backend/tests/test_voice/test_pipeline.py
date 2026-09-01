"""Integration-level coverage for CallAudioPipeline._run_turns.

Three real bugs lived in this concurrency wiring, all confirmed against
live calls, not just guessed at:

1. "After I speak once it never responds again" — a plain `async for pcm
   in buffer.utterances(track): await handle(pcm)` only calls track.recv()
   again once handle() (STT+LLM+TTS) fully returns, so nobody drains the
   mic in real time while a reply is being generated/played. Fixed by
   running buffer.utterances() as its own continuously-draining task (see
   test_run_turns_handles_two_separate_utterances).
2. "Not hearing properly" / replies answering something said long ago —
   confirmed live via container logs: one real call detected 8 utterances
   but only transcribed 3, with one answered 43 seconds late. An unbounded
   FIFO queue keeps every utterance detected while a turn (real seconds of
   STT+LLM+TTS) is in flight, then answers them one by one long after
   they're relevant — especially bad because getting no immediate reply
   makes a user say something else, compounding the backlog. Fixed by a
   maxsize=1 "latest wins" queue (see
   test_run_turns_supersedes_stale_utterance_while_busy).
3. "I said hello way before it responded" — confirmed live: turns were
   fully serialized end to end, so the *next* utterance wasn't even
   transcribed until the *current* reply had entirely finished playing out
   loud in real time (many seconds for a 2-sentence reply). Fixed by
   splitting each turn into _prepare_reply (STT+LLM+TTS-synthesis, no
   audio output) and _play_reply (mute+send+drain), and overlapping the
   next utterance's _prepare_reply with the current one's _play_reply —
   only playback itself stays serialized (see
   test_run_turns_overlaps_next_prepare_with_current_playback).

_FakeIncomingTrack.recv() awaits a real event-loop tick (asyncio.sleep(0))
per frame — without that, the whole producer runs to completion in one
uninterrupted step before the consumer ever gets scheduled at all, which
would hide bug #2 entirely (every produced utterance would just pile up
before anything could consume the first one) and not reflect how frames
actually arrive in a real call.

Also covers a real (not-yet-shipped-when-first-reported) gap: voice calls
had zero delegation capability, so an agent asked to do something outside
its own ability (e.g. "write me a page") could only ever say it can't —
even when the exact same agent already has a configured teammate for
that in text chat/tasks. _llm_turn now wires the same agents-as-tools
roster chat.py uses, but through a voice-appropriate, non-blocking
delegation executor (see test_llm_turn_delegates_instead_of_blocking) —
the blocking one used by chat/tasks (task_worker.py's make_tool_executor)
awaits the delegated task to *fully finish* before returning, which is
fine for chat but would sit a live call in dead air for however long that
takes.
"""

import asyncio

import av
import numpy as np
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_collaborator import AgentCollaborator
from app.models.task import Task
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
        await asyncio.sleep(0)
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
    # _llm_turn calls chat_stream() directly (not the chat() convenience
    # wrapper) so it can pass tools/tool_executor through for delegation —
    # this stub mirrors a CLI-engine's chat_stream(): ignores tools/
    # tool_executor and yields the whole reply as one chunk.
    async def chat_stream(self, message: str, history: list[dict], tools=None, tool_executor=None):
        yield f"reply to: {message}"


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


async def test_run_turns_supersedes_stale_utterance_while_busy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression coverage for the "not hearing properly" report — confirmed
    live to actually be a growing backlog: a real call detected 8
    utterances but only ever transcribed 3, one of them 43 seconds late.
    While a turn is in flight (STT+LLM+TTS takes real seconds), an
    unbounded FIFO queue keeps every utterance detected in the meantime and
    answers them all, one by one, long after they're relevant. This drives
    three utterances through _run_turns where the first turn's LLM call is
    slow enough for utterances 2 and 3 to both be detected before it
    returns, and asserts utterance 2 gets superseded/dropped rather than
    answered stale — only 1 and 3 (the most recent) get a reply.
    """
    calls: list[str] = []

    class _SlowFirstEngine:
        async def chat_stream(self, message: str, history: list[dict], tools=None, tool_executor=None):
            calls.append(message)
            if message == "first":
                # Real wall-clock delay — long enough for the producer
                # (which yields via asyncio.sleep(0) per frame, effectively
                # instant) to race ahead and produce+supersede utterance 2
                # before this turn ever finishes. 50ms measured too tight
                # live (the producer only reached utterance 2 by then,
                # third wasn't ready yet, so the fast/instant "second" turn
                # got processed before third ever arrived) — 250ms gives a
                # comfortable margin to reach utterance 3 too.
                await asyncio.sleep(0.25)
            yield f"reply to: {message}"

    monkeypatch.setattr(pipeline_module, "get_engine", lambda agent: _SlowFirstEngine())

    transcripts: list[tuple[str, str]] = []

    async def emit_transcript(role: str, text: str) -> None:
        transcripts.append((role, text))

    async def emit_status(message: str) -> None:
        pass

    class _StubSTTByAmplitude:
        """Keys the returned transcript off the utterance's own amplitude
        rather than call order. A plain call-order stub (like _StubSTT)
        would silently return the wrong word here: the whole point of this
        test is that the "second" utterance never reaches transcribe() at
        all (discarded before ever being handled), so consuming a shared
        transcript list in order would misattribute "second" to whichever
        utterance actually survives. Matches by nearest *peak* amplitude,
        not the mean — each buffered utterance is the loud burst plus
        ~600ms of trailing hangover silence tacked on before it closes
        (AudioFrameBuffer.utterances() keeps buffering through the
        hangover), and that silence is actually the *majority* of the
        buffer by duration, so a mean would just measure how much silence
        got attached, not which burst amplitude was spoken (confirmed
        live: it collapsed every case to the smallest reference). The
        reference amplitudes are spaced far enough apart (10000) that
        resample ripple can never cross into a neighboring bucket."""

        def __init__(self, words_by_amplitude: dict[int, str]) -> None:
            self._words_by_amplitude = words_by_amplitude

        def is_configured(self) -> bool:
            return True

        async def transcribe(self, pcm: bytes, language: str = "unknown") -> str:
            samples = np.frombuffer(pcm, dtype=np.int16)
            peak_amplitude = float(np.max(np.abs(samples.astype(np.float64))))
            closest = min(self._words_by_amplitude, key=lambda a: abs(a - peak_amplitude))
            return self._words_by_amplitude[closest]

    outgoing = _FakeOutgoingTrack()
    pipeline = CallAudioPipeline(
        agent=_agent(), outgoing=outgoing, emit_status=emit_status, emit_transcript=emit_transcript
    )
    pipeline.stt = _StubSTTByAmplitude({30000: "first", 20000: "second", 10000: "third"})
    pipeline.tts = _StubTTS()

    frames = [
        *_ms_of_frames(50, 600),  # calibration
        *_ms_of_frames(50, 400),  # quiet lead-in
        *_ms_of_frames(30000, 500),  # utterance 1 ("first")
        *_ms_of_frames(50, 700),  # closes utterance 1
        *_ms_of_frames(20000, 500),  # utterance 2 ("second") — should be superseded
        *_ms_of_frames(50, 700),  # closes utterance 2
        *_ms_of_frames(10000, 500),  # utterance 3 ("third") — most recent, should survive
        *_ms_of_frames(50, 700),  # closes utterance 3
    ]

    await pipeline._run_turns(_FakeIncomingTrack(frames))

    # "second" was detected while "first" was still being handled and gets
    # replaced in the queue by "third" — never reaching the engine at all.
    assert calls == ["first", "third"]
    assert transcripts == [
        ("user", "first"),
        ("agent", "reply to: first"),
        ("user", "third"),
        ("agent", "reply to: third"),
    ]


async def test_run_turns_overlaps_next_prepare_with_current_playback() -> None:
    """Regression coverage for "I said hello way before it responded" —
    confirmed live that nothing about the *next* utterance started until
    the *current* reply had entirely finished playing out loud. This
    drives two utterances through _run_turns with an artificially slow
    playback drain on the first reply, and asserts the second utterance's
    STT call actually starts *while* that drain is still running — proving
    _prepare_reply and _play_reply genuinely overlap rather than running
    one fully after the other.
    """
    loop = asyncio.get_event_loop()
    timeline: list[tuple[str, float]] = []

    class _TimedOutgoingTrack(_FakeOutgoingTrack):
        async def wait_until_drained(self, extra_settle_s: float = 0.0) -> None:
            timeline.append(("drain_start", loop.time()))
            await asyncio.sleep(0.2)
            timeline.append(("drain_end", loop.time()))

    class _TimedSTT(_StubSTT):
        async def transcribe(self, pcm: bytes, language: str = "unknown") -> str:
            timeline.append(("stt_call", loop.time()))
            return await super().transcribe(pcm, language)

    outgoing = _TimedOutgoingTrack()
    pipeline = CallAudioPipeline(
        agent=_agent(),
        outgoing=outgoing,
        emit_status=lambda message: _noop(),
        emit_transcript=lambda role, text: _noop(),
    )
    pipeline.stt = _TimedSTT(["hey jarvis", "what's the weather"])
    pipeline.tts = _StubTTS()

    frames = [
        *_ms_of_frames(50, 600),  # calibration
        *_ms_of_frames(50, 400),  # quiet lead-in
        *_ms_of_frames(20000, 500),  # utterance 1
        *_ms_of_frames(50, 700),  # closes utterance 1
        *_ms_of_frames(20000, 500),  # utterance 2
        *_ms_of_frames(50, 700),  # closes utterance 2
    ]

    await pipeline._run_turns(_FakeIncomingTrack(frames))

    stt_calls = [t for name, t in timeline if name == "stt_call"]
    drain_start = next(t for name, t in timeline if name == "drain_start")
    drain_end = next(t for name, t in timeline if name == "drain_end")
    assert len(stt_calls) == 2
    # The second utterance's STT call must start while the first reply's
    # playback drain is still in flight, not after it finishes.
    assert drain_start < stt_calls[1] < drain_end


class _NoCloseSessionCM:
    """Wraps an existing AsyncSession so `async with ...` doesn't close it —
    _llm_turn opens its own session via `async with async_session_factory()
    as session`, which calls session.close() on exit; tests need the
    shared, rollback-wrapped db_session fixture to stay open across that
    call. Mirrors test_workers/test_task_worker.py's identical helper."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *exc_info: object) -> bool:
        return False


async def test_llm_turn_delegates_instead_of_blocking(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    """Regression coverage for "why can't it delegate to a coder like text
    chat can" — Jarvis, asked to write code on a call, could previously
    only say it can't, even with a real coder teammate configured, because
    _llm_turn never built or passed any tools at all. This proves
    delegation now actually happens (a real Task row gets created for the
    teammate) AND that it doesn't block the call on the delegated work
    finishing — task_worker.py's make_tool_executor (used by chat/tasks)
    awaits the child task to fully complete, which could be seconds to
    minutes for a real coding task; a live call can't sit in dead air that
    long, so the voice-specific executor only creates+dispatches the task
    and returns immediately, same as any other task-creation path
    (dispatch_task, monkeypatched here to skip the real Celery hop)."""
    jarvis = Agent(
        name="Jarvis", role="Assistant", engine_type="api", engine_provider="anthropic",
        personality_traits=[],
    )
    coder = Agent(
        name="Codey", role="Coder", engine_type="api", engine_provider="anthropic",
        personality_traits=[],
    )
    db_session.add_all([jarvis, coder])
    await db_session.flush()
    db_session.add(AgentCollaborator(agent_id=jarvis.id, collaborator_agent_id=coder.id))
    await db_session.flush()

    monkeypatch.setattr(pipeline_module, "async_session_factory", lambda: _NoCloseSessionCM(db_session))
    dispatched: list[Task] = []

    async def fake_dispatch_task(session, task: Task) -> None:
        dispatched.append(task)
        task.status = "assigned"  # mirrors dispatch_task's own real effect

    monkeypatch.setattr(pipeline_module, "dispatch_task", fake_dispatch_task)

    class _DelegatingEngine:
        async def chat_stream(self, message: str, history: list[dict], tools=None, tool_executor=None, system_prompt=None):
            assert tools, "delegation tool was never built/passed through"
            # Picks by description match rather than tools[0] — delegation is
            # no longer scoped to a single curated collaborator (see
            # get_delegation_candidates), so other agents may also be in the
            # tools list; a real model would pick "Codey" by reading each
            # tool's name/role description, same as here.
            match = next(t for t in tools if "Codey" in t["function"]["description"])
            content, is_error = await tool_executor(
                match["function"]["name"], {"brief": "build the shoe store page"}
            )
            assert is_error is False
            yield f"Sure — {content}"

    monkeypatch.setattr(pipeline_module, "get_engine", lambda agent: _DelegatingEngine())

    pipeline = CallAudioPipeline(
        agent=jarvis,
        outgoing=_FakeOutgoingTrack(),
        emit_status=lambda message: _noop(),
        emit_transcript=lambda role, text: _noop(),
    )

    reply = await pipeline._llm_turn("Can you build me a shoe store page?")

    assert "Codey" in reply
    assert len(dispatched) == 1
    child = dispatched[0]
    assert child.assigned_agents == [coder.id]
    assert child.brief == "build the shoe store page"
    assert child.status == "assigned"  # dispatched, not awaited to completion


async def _noop() -> None:
    return None
