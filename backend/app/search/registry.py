"""Selects the web-search provider for a given agent — mirrors
app/media/registry.py's shape, including its "agent's own key first, global
fallback" resolution (an agent can have its own dedicated Tavily key via a
per-agent quota/account, e.g. a research-focused agent, rather than always
sharing the one global Settings key).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.agent import Agent
from app.search.base import WebSearchProvider
from app.search.tavily import TavilyProvider
from app.utils.encryption import decrypt_value
from app.utils.secrets_store import TAVILY_API_KEY_SETTING, get_configured_secret


async def _resolve_tavily_key(agent: Agent, session: AsyncSession) -> str | None:
    """An agent's own Tavily key (agents.tavily_api_key_encrypted) is tried
    first; only an agent with no key of its own falls back to the global
    TAVILY_API_KEY_SETTING/env var. Mirrors media/registry.py's
    _resolve_gemini_key exactly, just without that function's extra
    "does this agent's chat engine happen to be the same provider" branch —
    Tavily is never a chat engine_provider, so there's no key to reuse from
    elsewhere; this is its own dedicated credential.
    """
    if agent.tavily_api_key_encrypted:
        own_key = decrypt_value(agent.tavily_api_key_encrypted)
        if own_key:
            return own_key
    return await get_configured_secret(
        session, TAVILY_API_KEY_SETTING, env_fallback=get_settings().tavily_api_key
    )


async def get_search_provider(agent: Agent, session: AsyncSession) -> WebSearchProvider | None:
    """Returns None (not a not-configured instance) when nothing resolves,
    so callers can use a plain `if get_search_provider(...) is not None` gate.

    Gated on `agent.has_web_search` first — a resolved Tavily key alone is
    not sufficient. Same explicit-opt-in principle as media/registry.py's
    is_media_specialist gate: without it, every agent would silently get
    web search the moment any one Tavily key was configured anywhere, the
    exact class of bug that gate was built to close for media generation.
    """
    if not agent.has_web_search:
        return None
    provider = TavilyProvider(await _resolve_tavily_key(agent, session))
    return provider if provider.is_configured() else None
