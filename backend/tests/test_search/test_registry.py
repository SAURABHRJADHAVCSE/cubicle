"""Tests for search/registry.py's has_web_search gate.

Mirrors tests/test_media/test_registry.py's exact structure/reasoning — a
configured Tavily key resolving is necessary but not sufficient; without
the explicit has_web_search flag, adding one global Tavily key would
silently give every agent on the roster the tool, the same class of bug
is_media_specialist was built to close for media generation.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.search.registry import _resolve_tavily_key, get_search_provider
from app.utils.encryption import encrypt_value
from app.utils.secrets_store import TAVILY_API_KEY_SETTING, delete_setting, set_encrypted_setting


def _agent(**overrides) -> Agent:
    base = dict(
        name="Agent", role="Some Role", engine_type="api", engine_provider="anthropic",
        personality_traits=[], has_web_search=False,
    )
    return Agent(**{**base, **overrides})


async def test_flag_off_returns_none_even_with_key_configured(db_session: AsyncSession) -> None:
    await set_encrypted_setting(db_session, TAVILY_API_KEY_SETTING, "tvly-fake")
    agent = _agent(has_web_search=False)
    assert await get_search_provider(agent, db_session) is None


async def test_flag_on_no_key_anywhere_returns_none(db_session: AsyncSession) -> None:
    # This suite runs against the real shared dev DB (see conftest.py) — a
    # global Tavily key may genuinely be configured there already, so a
    # "no key anywhere" baseline has to be established explicitly rather
    # than assumed.
    await delete_setting(db_session, TAVILY_API_KEY_SETTING)
    agent = _agent(has_web_search=True)
    assert await get_search_provider(agent, db_session) is None


async def test_flag_on_with_global_key_returns_configured_provider(
    db_session: AsyncSession,
) -> None:
    await set_encrypted_setting(db_session, TAVILY_API_KEY_SETTING, "tvly-fake")
    agent = _agent(has_web_search=True)
    provider = await get_search_provider(agent, db_session)
    assert provider is not None
    assert provider.is_configured() is True


async def test_agents_own_key_wins_over_global_fallback(db_session: AsyncSession) -> None:
    """Mirrors media/registry.py's _resolve_gemini_key priority — an agent
    with its own Tavily key uses that, not the global one, even when both
    are configured."""
    await set_encrypted_setting(db_session, TAVILY_API_KEY_SETTING, "tvly-global")
    agent = _agent(
        has_web_search=True, tavily_api_key_encrypted=encrypt_value("tvly-agent-own")
    )
    assert await _resolve_tavily_key(agent, db_session) == "tvly-agent-own"


async def test_falls_back_to_global_key_when_agent_has_no_own_key(
    db_session: AsyncSession,
) -> None:
    await set_encrypted_setting(db_session, TAVILY_API_KEY_SETTING, "tvly-global")
    agent = _agent(has_web_search=True, tavily_api_key_encrypted=None)
    assert await _resolve_tavily_key(agent, db_session) == "tvly-global"


async def test_agents_own_key_alone_is_sufficient_without_global(
    db_session: AsyncSession,
) -> None:
    agent = _agent(
        has_web_search=True, tavily_api_key_encrypted=encrypt_value("tvly-agent-own")
    )
    provider = await get_search_provider(agent, db_session)
    assert provider is not None
    assert provider.is_configured() is True
