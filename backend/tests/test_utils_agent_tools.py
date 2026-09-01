"""Tests for app/utils/agent_tools.py — turning an agent's teammate roster
into OpenAI-style function-calling tool schemas."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_collaborator import AgentCollaborator
from app.utils.agent_tools import build_tool_schema, build_tools_for_agent, get_collaborators, slugify_tool_name


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
