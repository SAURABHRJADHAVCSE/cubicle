"""Tests for media/registry.py's is_media_specialist gate.

Regression coverage for a live bug: media generation used to be granted to
any agent that happened to resolve a usable Gemini key (its own, or the
global fallback) — with no regard for role. A personal assistant sharing a
Gemini provider with the actual specialist got its own generate_image tool
and used it directly instead of ever delegating to the specialist. These
pin that a Gemini key resolving is necessary but no longer sufficient.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.media.registry import get_image_generator, get_video_generator
from app.models.agent import Agent
from app.utils.encryption import encrypt_value
from app.utils.secrets_store import GEMINI_MEDIA_API_KEY_SETTING, set_encrypted_setting


def _agent(**overrides) -> Agent:
    base = dict(
        name="Agent", role="Some Role", engine_type="api", engine_provider="gemini",
        personality_traits=[], is_media_specialist=False,
    )
    return Agent(**{**base, **overrides})


async def test_own_gemini_key_not_enough_without_the_flag(db_session: AsyncSession) -> None:
    agent = _agent(engine_api_key_encrypted=encrypt_value("real-key"), is_media_specialist=False)
    assert await get_image_generator(agent, db_session) is None
    assert await get_video_generator(agent, db_session) is None


async def test_global_fallback_key_not_enough_without_the_flag(db_session: AsyncSession) -> None:
    await set_encrypted_setting(db_session, GEMINI_MEDIA_API_KEY_SETTING, "global-key")
    agent = _agent(is_media_specialist=False)
    assert await get_image_generator(agent, db_session) is None


async def test_flag_set_with_own_key_grants_the_generator(db_session: AsyncSession) -> None:
    agent = _agent(engine_api_key_encrypted=encrypt_value("real-key"), is_media_specialist=True)
    image = await get_image_generator(agent, db_session)
    video = await get_video_generator(agent, db_session)
    assert image is not None
    assert video is not None


async def test_flag_set_but_no_key_anywhere_still_returns_none(db_session: AsyncSession) -> None:
    agent = _agent(is_media_specialist=True)
    assert await get_image_generator(agent, db_session) is None


async def test_flag_set_falls_back_to_global_key_when_agent_has_none(
    db_session: AsyncSession,
) -> None:
    await set_encrypted_setting(db_session, GEMINI_MEDIA_API_KEY_SETTING, "global-key")
    agent = _agent(is_media_specialist=True)
    assert await get_image_generator(agent, db_session) is not None
