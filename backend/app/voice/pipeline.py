"""Per-call audio orchestration: incoming mic audio -> STT -> agent LLM
turn -> TTS -> outgoing audio, or a test-tone-and-echo fallback proving
the transport works when no STT/TTS provider is configured yet.
"""

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
        self.stt = get_stt_provider()
        self.tts = get_tts_provider()

    async def start(self, incoming_track) -> None:
        logger.info("voice_call_pipeline_started", agent_id=str(self.agent.id))
        if not (self.stt.is_configured() and self.tts.is_configured()):
            await self.outgoing.enqueue_frames(generate_tone_frames())
            await self.emit_status(_NOT_CONFIGURED_MESSAGE)
            logger.info("voice_call_not_configured_fallback", agent_id=str(self.agent.id))
            await self._run_echo(incoming_track)
            return
        await self._run_turns(incoming_track)

    async def _run_turns(self, incoming_track) -> None:
        async for pcm in AudioFrameBuffer().utterances(incoming_track):
            text = await self.stt.transcribe(pcm)
            if not text.strip():
                continue
            await self.emit_transcript("user", text)

            reply = await self._llm_turn(text)
            await self.emit_transcript("agent", reply)

            audio, rate = await self.tts.synthesize(
                reply, self.agent.voice_language, self.agent.voice_gender, self.agent.voice_pace
            )
            if audio:
                await self.outgoing.enqueue_frames(resample_to_track_format(audio, rate))

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
