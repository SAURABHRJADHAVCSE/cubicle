"""Per-call audio orchestration: incoming mic audio -> STT -> agent LLM
turn -> TTS -> outgoing audio, or a test-tone-and-echo fallback proving
the transport works when no STT/TTS provider is configured yet.
"""

import asyncio
import contextlib
from collections.abc import Awaitable, Callable

import structlog

from app.engines.registry import get_engine
from app.models.agent import Agent
from app.voice.audio import (
    AudioFrameBuffer,
    AudioQueueTrack,
    generate_tone_frames,
    resample_frame_to_track_format,
    resample_to_track_format,
)
from app.voice.registry import get_stt_provider, get_tts_provider

logger = structlog.get_logger()

_NOT_CONFIGURED_MESSAGE = (
    "Voice provider not configured — playing a test tone and echoing your audio back."
)


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
        queue: asyncio.Queue[bytes] = asyncio.Queue()

        async def _produce() -> None:
            async for pcm in buffer.utterances(incoming_track):
                await queue.put(pcm)

        producer = asyncio.create_task(_produce())
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
                    await self._handle_utterance(pcm, buffer)
                except Exception as exc:  # noqa: BLE001 - one bad turn must not silently end the whole call
                    logger.error(
                        "voice_call_turn_failed", agent_id=str(self.agent.id), error=str(exc)
                    )
                    buffer.muted = False  # don't leave the mic muted if a turn blew up mid-reply
        finally:
            producer.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await producer

    async def _handle_utterance(self, pcm: bytes, buffer: AudioFrameBuffer) -> None:
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
            return
        logger.info("voice_call_transcribed", agent_id=str(self.agent.id), text=text)
        await self.emit_transcript("user", text)

        reply = await self._llm_turn(text)
        await self.emit_transcript("agent", reply)

        audio, rate = await self.tts.synthesize(
            reply, self.agent.voice_language, self.agent.voice_gender, self.agent.voice_pace
        )
        if audio:
            # Muted for the duration of our own reply (plus a settle
            # margin) so the mic can't hear it played back through the
            # peer's speakers and mistake it for the next thing the user
            # said — see AudioFrameBuffer.muted's docstring.
            buffer.muted = True
            try:
                await self.outgoing.enqueue_frames(resample_to_track_format(audio, rate))
                await self.outgoing.wait_until_drained()
            finally:
                buffer.muted = False
        else:
            logger.warning("voice_call_tts_returned_no_audio", agent_id=str(self.agent.id))

    async def _llm_turn(self, user_text: str) -> str:
        try:
            engine = get_engine(self.agent)
        except ValueError:
            return "I can't take calls with my current engine setup — check my configuration."

        personality = ", ".join(self.agent.personality_traits or []) or "professional"
        system_prompt = (
            f"You are {self.agent.name}, a {self.agent.role}. Personality: {personality}. "
            "You are on a live voice call. Keep replies short and conversational — "
            "1-3 sentences, no markdown, no lists, as if speaking out loud."
        )
        try:
            reply = await engine.chat(
                user_text, [{"role": "system", "content": system_prompt}, *self.history]
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
