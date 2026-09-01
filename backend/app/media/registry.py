"""Selects which MediaGenerator to use for a given agent — mirrors
voice/registry.py's get_stt_provider/get_tts_provider shape.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.media.base import MediaGenerator
from app.media.gemini_image import GeminiImageGenerator
from app.media.gemini_video import GeminiVideoGenerator
from app.models.agent import Agent
from app.utils.encryption import decrypt_value
from app.utils.secrets_store import GEMINI_MEDIA_API_KEY_SETTING, get_configured_secret


async def _resolve_gemini_key(agent: Agent, session: AsyncSession) -> str | None:
    """An agent that already talks to Gemini for chat (engine_provider ==
    "gemini", the BYO-API-provider case — see engines/registry.py's own
    identical decrypt_value call) reuses that same key for image/video
    generation too, so an agent like Wanda needs zero new configuration.
    Only agents with no Gemini key of their own fall back to the global
    GEMINI_MEDIA_API_KEY_SETTING/env var. One Gemini API key covers both
    Nano Banana (image) and Veo (video), so image and video generation
    share this exact resolution.
    """
    if agent.engine_provider == "gemini" and agent.engine_api_key_encrypted:
        own_key = decrypt_value(agent.engine_api_key_encrypted)
        if own_key:
            return own_key
    return await get_configured_secret(session, GEMINI_MEDIA_API_KEY_SETTING, env_fallback=None)


async def get_image_generator(agent: Agent, session: AsyncSession) -> MediaGenerator | None:
    """Returns None (not a not-configured instance) when nothing resolves,
    so callers can use a plain `if get_image_generator(...) is not None` gate.

    Gated on `agent.is_media_specialist` first — a Gemini key resolving is
    necessary but not sufficient. Without this, any agent sharing a Gemini
    key with the actual specialist (e.g. a personal assistant using the
    same provider) would also get its own generate_image tool and use it
    directly instead of ever delegating to the intended specialist.
    """
    if not agent.is_media_specialist:
        return None
    generator = GeminiImageGenerator(await _resolve_gemini_key(agent, session))
    return generator if generator.is_configured() else None


async def get_video_generator(agent: Agent, session: AsyncSession) -> MediaGenerator | None:
    if not agent.is_media_specialist:
        return None
    generator = GeminiVideoGenerator(await _resolve_gemini_key(agent, session))
    return generator if generator.is_configured() else None
