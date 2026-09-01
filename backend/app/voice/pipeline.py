"""Per-call audio orchestration: incoming mic audio -> STT -> agent LLM
turn -> TTS -> outgoing audio, or a test-tone-and-echo fallback proving
the transport works when no STT/TTS provider is configured yet.
"""

import asyncio
import contextlib
import uuid
from collections.abc import Awaitable, Callable

import structlog

from app.database import async_session_factory
from app.engines.base import ToolExecutor
from app.engines.registry import get_engine
from app.models.agent import Agent
from app.models.task import Task
from app.utils.agent_tools import build_tools_for_agent
from app.utils.time_context import current_date_line
from app.voice.audio import (
    AudioFrameBuffer,
    AudioQueueTrack,
    generate_tone_frames,
    resample_frame_to_track_format,
    resample_to_track_format,
)
from app.voice.registry import get_stt_provider, get_tts_provider
from app.workers.task_worker import dispatch_task

logger = structlog.get_logger()

_NOT_CONFIGURED_MESSAGE = (
    "Voice provider not configured — playing a test tone and echoing your audio back."
)


def _make_voice_delegation_executor(tool_by_name: dict[str, uuid.UUID]) -> ToolExecutor:
    """Delegation for a live voice call — same underlying Task/dispatch_task
    machinery as make_tool_executor (task_worker.py), used by task-based and
    chat-based delegation, but deliberately NOT the same blocking behavior:
    that one awaits the delegated task to fully finish before returning,
    which is fine for chat (a late reply is just late) but would sit a live
    call in dead air for however long the delegated work actually takes —
    seconds to minutes for a real coding task, exactly the kind of silence
    this session already found and fixed once (see _run_turns). This
    creates the task, dispatches it to Celery the normal way, and returns
    immediately — the model's own reply becomes the spoken acknowledgment,
    and the real work shows up in the task view like any other delegation.
    """

    async def tool_executor(tool_name: str, args: dict) -> tuple[str, bool]:
        target_id = tool_by_name.get(tool_name)
        if target_id is None:
            return f"Unknown tool: {tool_name}", True
        brief = (args or {}).get("brief", "").strip()
        if not brief:
            return "Missing required 'brief' argument.", True

        async with async_session_factory() as session:
            target = await session.get(Agent, target_id)
            if target is None:
                return "That teammate no longer exists.", True

            child = Task(
                title=f"Delegated to {target.name}",
                brief=brief,
                assigned_agents=[target.id],
                status="pending",
            )
            session.add(child)
            await session.flush()
            await dispatch_task(session, child)
            target_name = target.name

        return (
            f"Delegated to {target_name} — it's running in the background now; "
            "tell the caller it's underway and they can check progress in the task view.",
            False,
        )

    return tool_executor


class CallAudioPipeline:
    def __init__(
        self,
        agent: Agent,
        outgoing: AudioQueueTrack,
        emit_status: Callable[[str], Awaitable[None]],
        emit_transcript: Callable[[str, str], Awaitable[None]],
    ) -> None:
        self.agent = agent
        self.outgoing = outgoing
        self.emit_status = emit_status
        self.emit_transcript = emit_transcript
        self.history: list[dict] = []  # in-memory only, never persisted

    async def start(self, incoming_track) -> None:
        logger.info("voice_call_pipeline_started", agent_id=str(self.agent.id))
        # Resolved here, not __init__ — both now look up a possible
        # Settings-configured key (DB, async), which a sync constructor
        # can't await. See voice/registry.py's _resolve_sarvam_key.
        self.stt = await get_stt_provider()
        self.tts = await get_tts_provider()
        if not (self.stt.is_configured() and self.tts.is_configured()):
            await self.outgoing.enqueue_frames(generate_tone_frames())
            await self.emit_status(_NOT_CONFIGURED_MESSAGE)
            logger.info("voice_call_not_configured_fallback", agent_id=str(self.agent.id))
            await self._run_echo(incoming_track)
            return
        await self._run_turns(incoming_track)

    async def _run_turns(self, incoming_track) -> None:
        # Producer/consumer, not a plain `async for pcm in buffer.utterances
        # (track): await handle(pcm)` — that sequential form only calls
        # track.recv() again once handle() (STT+LLM+TTS) fully returns, so
        # while a reply is being generated and played, nobody is draining
        # the mic in real time at all; toggling buffer.muted during that
        # window then has no effect, since the frames that piled up get
        # processed as a backlog only *after* muted is already back to
        # False. Running buffer.utterances() as its own continuously-
        # draining task means muted is checked frame-by-frame, live, which
        # is what actually makes it work — see AudioFrameBuffer.muted.
        buffer = AudioFrameBuffer()
        # maxsize=1, latest-wins, not an unbounded FIFO — a full STT->LLM->
        # TTS turn takes real seconds, and if the user (hearing nothing
        # back yet) says something else in the meantime, an unbounded
        # queue keeps every utterance and answers them in order long after
        # they're relevant. Confirmed live: 8 utterances detected in one
        # call, only 3 ever transcribed, one answered 43 seconds late —
        # each reply landing well after the conversation had moved on,
        # looking exactly like "not hearing properly". Only the most
        # recent thing the user said is ever worth responding to.
        queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=1)

        async def _produce() -> None:
            async for pcm in buffer.utterances(incoming_track):
                if queue.full():
                    stale = queue.get_nowait()
                    logger.info(
                        "voice_call_utterance_superseded",
                        agent_id=str(self.agent.id), discarded_bytes=len(stale),
                    )
                queue.put_nowait(pcm)

        producer = asyncio.create_task(_produce())
        # A full reply is spoken out loud in real time before the mic can
        # be trusted again (see AudioFrameBuffer.muted), so *playback*
        # must stay strictly serialized — but STT+LLM+TTS-synthesis for
        # the *next* utterance is just request/response work with no audio
        # output yet, and has no reason to wait for that. Confirmed live:
        # turns were fully serialized end to end, so a 2-sentence reply
        # (TTS speech time alone, plus STT+LLM+TTS-synthesis round trips)
        # made the next utterance sit answered 15-20s after it was said.
        # play_task runs the current reply's mute+send+drain in the
        # background while the loop moves straight on to preparing the
        # next one — by the time play_task finishes, the next reply is
        # often already synthesized and ready to go.
        play_task: asyncio.Task | None = None
        try:
            while not producer.done() or not queue.empty():
                get_utterance = asyncio.ensure_future(queue.get())
                done, _pending = await asyncio.wait(
                    {get_utterance, producer}, return_when=asyncio.FIRST_COMPLETED
                )
                if get_utterance not in done:
                    get_utterance.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await get_utterance
                    continue  # producer finished (call ended) with nothing left queued
                pcm = get_utterance.result()
                try:
                    reply_audio = await self._prepare_reply(pcm)
                except Exception as exc:  # noqa: BLE001 - one bad turn must not silently end the whole call
                    logger.error(
                        "voice_call_turn_failed", agent_id=str(self.agent.id), error=str(exc)
                    )
                    continue
                if reply_audio is None:
                    continue  # empty transcript or no audio — nothing to play
                if play_task is not None:
                    await play_task
                play_task = asyncio.create_task(self._play_reply(reply_audio, buffer))
        finally:
            if play_task is not None:
                with contextlib.suppress(asyncio.CancelledError):
                    await play_task
            producer.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await producer

    async def _prepare_reply(self, pcm: bytes) -> tuple[bytes, int] | None:
        """STT -> LLM -> TTS-synthesis for one utterance, with no audio
        output side effect — safe to run while a previous reply is still
        being played back (see _run_turns). Returns the synthesized
        (audio_bytes, sample_rate) for _play_reply, or None if there's
        nothing worth saying."""
        # Without this, STT defaults to language auto-detection — confirmed
        # live to sometimes guess wrong and transcribe nonsense as a
        # result. The agent's own configured language is a much stronger
        # signal than guessing from a few hundred ms of audio.
        text = await self.stt.transcribe(pcm, self.agent.voice_language)
        if not text.strip():
            # A prior "no response" report traced back to exactly this
            # branch being entirely silent — an utterance detected fine but
            # STT coming back empty (bad/unclear audio, a transient Sarvam
            # hiccup, ...) looked identical in the logs to nothing
            # happening at all. Now it says so.
            logger.info(
                "voice_call_empty_transcript", agent_id=str(self.agent.id), pcm_bytes=len(pcm)
            )
            return None
        logger.info("voice_call_transcribed", agent_id=str(self.agent.id), text=text)
        await self.emit_transcript("user", text)

        reply = await self._llm_turn(text)
        await self.emit_transcript("agent", reply)

        audio, rate = await self.tts.synthesize(
            reply, self.agent.voice_language, self.agent.voice_gender, self.agent.voice_pace
        )
        if not audio:
            logger.warning("voice_call_tts_returned_no_audio", agent_id=str(self.agent.id))
            return None
        return audio, rate

    async def _play_reply(self, reply: tuple[bytes, int], buffer: AudioFrameBuffer) -> None:
        """Sends a synthesized reply out over the call, muting the mic for
        its duration — see AudioFrameBuffer.muted's docstring for why.
        Runs as its own background task (see _run_turns), so nothing awaits
        it until the *next* reply is ready to play — errors are therefore
        handled internally rather than raised, so a failed playback can't
        get silently dropped as an "unretrieved task exception"."""
        audio, rate = reply
        buffer.muted = True
        try:
            await self.outgoing.enqueue_frames(resample_to_track_format(audio, rate))
            await self.outgoing.wait_until_drained()
        except Exception as exc:  # noqa: BLE001 - one bad playback must not end the call
            logger.error("voice_call_playback_failed", agent_id=str(self.agent.id), error=str(exc))
        finally:
            buffer.muted = False

    async def _llm_turn(self, user_text: str) -> str:
        try:
            engine = get_engine(self.agent)
        except ValueError:
            return "I can't take calls with my current engine setup — check my configuration."

        # Same agents-as-tools roster api/chat.py's live text chat already
        # delegates through — an API-engine agent with configured
        # teammates (AgentCollaborator rows) gets a real delegate_to_*
        # tool per teammate; anyone else (CLI-engine agents, or an agent
        # with no configured teammates) gets none, same as chat.py.
        async with async_session_factory() as session:
            tools, delegate_agents_by_name = await build_tools_for_agent(session, self.agent)
        tool_executor = (
            _make_voice_delegation_executor({name: a.id for name, a in delegate_agents_by_name.items()})
            if tools
            else None
        )

        personality = ", ".join(self.agent.personality_traits or []) or "professional"
        if delegate_agents_by_name:
            teammates = ", ".join(a.name for a in delegate_agents_by_name.values())
            capability_note = (
                f"You can delegate real work to your teammates on this call: {teammates}. "
                "If asked to do something outside your own ability (like writing code), "
                "delegate it to the right teammate instead of saying you can't, then tell "
                "the caller it's underway and they can check progress in the task view. "
                "Beyond an actual delegation, you still cannot access a calendar, send "
                "email, or browse the web — nothing else you say has any real-world effect."
            )
        else:
            # Without this, the model free-associates a plausible-sounding
            # assistant response and fabricates having taken a real action
            # — confirmed live: asked to schedule a doctor's appointment,
            # it invented a named doctor and a specific time; asked to
            # create an HTML page, it claimed to have emailed it.
            capability_note = (
                "You have NO tools on this call: you cannot access a calendar, "
                "send email, browse the web, or create/save/send any real file, "
                "task, or reminder — nothing you say here has any real-world "
                "effect. Never claim to have done one of these things. If asked "
                "to do something like that, say plainly you can't do it on a "
                "call and that they can ask you to actually do it in the chat "
                "or task view instead."
            )
        system_prompt = (
            f"You are {self.agent.name}, a {self.agent.role}. Personality: {personality}. "
            f"{current_date_line()} "
            "You are on a live voice call. Keep replies short and conversational — "
            f"1-3 sentences, no markdown, no lists, as if speaking out loud. {capability_note}"
        )
        try:
            reply = "".join(
                [
                    chunk
                    async for chunk in engine.chat_stream(
                        user_text,
                        [{"role": "system", "content": system_prompt}, *self.history],
                        tools=tools or None,
                        tool_executor=tool_executor,
                    )
                ]
            )
        except Exception as exc:  # noqa: BLE001 - surface engine failures as a spoken reply
            logger.warning("voice_call_llm_turn_failed", agent_id=str(self.agent.id), error=str(exc))
            return "Sorry, I had trouble responding just now — could you say that again?"

        self.history += [
            {"role": "user", "content": user_text},
            {"role": "assistant", "content": reply},
        ]
        return reply

    async def _run_echo(self, incoming_track) -> None:
        while True:
            try:
                frame = await incoming_track.recv()
            except Exception:  # noqa: BLE001 - track ended (peer hung up, connection dropped)
                return
            await self.outgoing.enqueue_frames(resample_frame_to_track_format(frame))
