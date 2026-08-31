"""Provider selection — mirrors app/engines/registry.py's pattern. Only
one STT/TTS provider exists today (Sarvam); the interface in stt.py/tts.py
means adding a second is additive here, not a rewrite."""

from app.config import get_settings
from app.database import worker_session_factory
from app.utils.secrets_store import SARVAM_API_KEY_SETTING, get_configured_secret
from app.voice.stt import SarvamSTT, SpeechToText
from app.voice.tts import SarvamTTS, TextToSpeech


async def _resolve_sarvam_key() -> str | None:
    """Settings → Engine Providers (DB, encrypted) wins over the
    SARVAM_API_KEY env var — same lazy-resolve pattern as
    engines/litellm_engine.py's _resolve_api_key / engines/claude_code.py's
    stored-OAuth-token lookup, own worker_session_factory() session so this
    is safe to call from both the API process and Celery/call-handling
    contexts.
    """
    async with worker_session_factory() as session:
        return await get_configured_secret(
            session, SARVAM_API_KEY_SETTING, get_settings().sarvam_api_key
        )


async def get_stt_provider() -> SpeechToText:
    return SarvamSTT(api_key=await _resolve_sarvam_key())


async def get_tts_provider() -> TextToSpeech:
    return SarvamTTS(api_key=await _resolve_sarvam_key())
