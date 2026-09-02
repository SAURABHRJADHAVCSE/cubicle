"""Tests for app/utils/agent_tools.py — turning an agent's teammate roster
into OpenAI-style function-calling tool schemas."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_collaborator import AgentCollaborator
from app.utils.agent_tools import (
    WEB_CRAWL_TOOL,
    WEB_SEARCH_TOOL,
    build_agent_system_prompt,
    build_tool_schema,
    build_tools_for_agent,
    get_collaborators,
    slugify_tool_name,
)
from app.utils.secrets_store import TAVILY_API_KEY_SETTING, set_encrypted_setting


def _agent(**overrides) -> Agent:
    base = dict(name="Artist", role="Image Gen", engine_type="api", engine_provider="anthropic", personality_traits=[])
    return Agent(**{**base, **overrides})


def test_slugify_tool_name_produces_valid_token() -> None:
    agent = _agent(name="Caption Writer! 🎨")
    agent.id = uuid.uuid4()
    slug = slugify_tool_name(agent)
    assert slug.replace("_", "").replace("-", "").isalnum()
    assert str(agent.id)[:8] in slug


def test_build_tool_schema_shape() -> None:
    agent = _agent(name="Artist", role="Image Generator")
    agent.id = uuid.uuid4()
    schema = build_tool_schema(agent)

    assert schema["type"] == "function"
    fn = schema["function"]
    assert fn["name"].startswith("delegate_to_")
    assert "Artist" in fn["description"]
    assert "Image Generator" in fn["description"]
    assert fn["parameters"]["required"] == ["brief"]
    assert "brief" in fn["parameters"]["properties"]


async def test_get_collaborators_returns_assigned_teammates(db_session: AsyncSession) -> None:
    main = _agent(name="Manager")
    teammate1 = _agent(name="Artist")
    teammate2 = _agent(name="Writer")
    unrelated = _agent(name="Stranger")
    db_session.add_all([main, teammate1, teammate2, unrelated])
    await db_session.flush()
    db_session.add_all(
        [
            AgentCollaborator(agent_id=main.id, collaborator_agent_id=teammate1.id),
            AgentCollaborator(agent_id=main.id, collaborator_agent_id=teammate2.id),
        ]
    )
    await db_session.flush()

    collaborators = await get_collaborators(db_session, main)

    assert {c.name for c in collaborators} == {"Artist", "Writer"}


async def test_get_collaborators_empty_when_none_assigned(db_session: AsyncSession) -> None:
    main = _agent(name="Manager")
    db_session.add(main)
    await db_session.flush()

    assert await get_collaborators(db_session, main) == []


async def test_build_tools_for_agent_empty_for_cli_engine(db_session: AsyncSession) -> None:
    main = _agent(name="Manager", engine_type="cli", engine_provider="claude_code")
    teammate = _agent(name="Artist")
    db_session.add_all([main, teammate])
    await db_session.flush()
    db_session.add(AgentCollaborator(agent_id=main.id, collaborator_agent_id=teammate.id))
    await db_session.flush()

    tools, by_name = await build_tools_for_agent(db_session, main)

    # Even with a collaborator row present, a CLI-engine agent gets no tools
    # — it has no structured tool-calling protocol Cubicle can drive.
    assert tools == []
    assert by_name == {}


async def test_build_tools_for_agent_includes_agents_with_no_curated_link(
    db_session: AsyncSession,
) -> None:
    """Delegation is no longer scoped to the AgentCollaborator roster — an
    API-engine agent should see a delegate tool for another agent even when
    no AgentCollaborator row links them, so it can pick whichever teammate
    actually fits the task rather than only ones manually checked in the
    Team panel (see build_agent_system_prompt's tool-selection guardrail).
    """
    main = _agent(name="Manager")
    stranger = _agent(name="Stranger", role="Copywriter")
    db_session.add_all([main, stranger])
    await db_session.flush()
    # Deliberately no AgentCollaborator row between them.

    tools, by_name = await build_tools_for_agent(db_session, main)

    assert stranger.id in {a.id for a in by_name.values()}


async def test_build_tools_for_agent_returns_schema_and_lookup(db_session: AsyncSession) -> None:
    main = _agent(name="Manager")
    teammate = _agent(name="Artist", role="Image Gen")
    db_session.add_all([main, teammate])
    await db_session.flush()
    db_session.add(AgentCollaborator(agent_id=main.id, collaborator_agent_id=teammate.id))
    await db_session.flush()

    tools, by_name = await build_tools_for_agent(db_session, main)

    matching = [name for name, agent in by_name.items() if agent.id == teammate.id]
    assert len(matching) == 1
    schema = next(t for t in tools if t["function"]["name"] == matching[0])
    assert "Artist" in schema["function"]["description"]


async def test_build_tools_for_agent_includes_web_search_when_configured(
    db_session: AsyncSession,
) -> None:
    await set_encrypted_setting(db_session, TAVILY_API_KEY_SETTING, "tvly-fake")
    agent = _agent(name="Jarvis", has_web_search=True)
    db_session.add(agent)
    await db_session.flush()

    tools, _by_name = await build_tools_for_agent(db_session, agent)

    names = {t["function"]["name"] for t in tools}
    assert WEB_SEARCH_TOOL in names
    assert WEB_CRAWL_TOOL in names


async def test_build_tools_for_agent_excludes_web_search_without_flag(
    db_session: AsyncSession,
) -> None:
    await set_encrypted_setting(db_session, TAVILY_API_KEY_SETTING, "tvly-fake")
    agent = _agent(name="Jarvis", has_web_search=False)
    db_session.add(agent)
    await db_session.flush()

    tools, _by_name = await build_tools_for_agent(db_session, agent)

    names = {t["function"]["name"] for t in tools}
    assert WEB_SEARCH_TOOL not in names
    assert WEB_CRAWL_TOOL not in names


def _web_search_schema() -> dict:
    return {"type": "function", "function": {"name": WEB_SEARCH_TOOL, "description": "search"}}


def test_system_prompt_omits_delegate_instructions_when_only_fixed_tools_present() -> None:
    """_FIXED_TOOL_NAMES must exclude web_search/web_crawl (and the media
    tools) from the delegate-tools instruction block — otherwise a search-
    only agent's system prompt would incorrectly tell it to "pick the
    right teammate" among tools that aren't teammates at all."""
    agent = _agent(name="Jarvis")
    prompt = build_agent_system_prompt(agent, [_web_search_schema()])

    assert "pick whichever teammate" not in prompt
    assert "web search isn't set up" not in prompt  # the tool IS present, so no guardrail


def test_system_prompt_adds_search_guardrail_when_absent() -> None:
    agent = _agent(name="Jarvis")
    prompt = build_agent_system_prompt(agent, [])

    assert "web search isn't set up" in prompt


def test_system_prompt_includes_delegate_instructions_alongside_fixed_tools() -> None:
    agent = _agent(name="Jarvis")
    delegate_schema = {
        "type": "function",
        "function": {"name": "delegate_to_wanda", "description": "Delegate a task to Wanda, a Artist."},
    }
    prompt = build_agent_system_prompt(agent, [delegate_schema, _web_search_schema()])

    assert "pick whichever teammate" in prompt
    assert "web search isn't set up" not in prompt
