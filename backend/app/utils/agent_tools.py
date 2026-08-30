"""Turns an agent's explicit teammate roster (AgentCollaborator) into an
OpenAI-style function-calling tool list for litellm.acompletion(). Only
API-engine agents can hold collaborators (see api/agents.py's PUT
.../collaborators validation) — CLI-subprocess engines have no structured
tool-calling protocol Cubicle can hook into, so build_tools_for_agent()
returns nothing for them rather than assuming the caller already checked.
"""

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.agent_collaborator import AgentCollaborator
from app.utils.soul import read_soul

_SLUG_INVALID = re.compile(r"[^a-zA-Z0-9_-]+")
_MAX_SLUG_LEN = 40


def slugify_tool_name(agent: Agent) -> str:
    """A valid function-name token derived from the agent's name, suffixed
    with a short id fragment so two agents with the same/similar name never
    collide on the same tool name."""
    slug = _SLUG_INVALID.sub("_", agent.name.strip()).strip("_").lower() or "agent"
    slug = slug[:_MAX_SLUG_LEN]
    return f"{slug}_{str(agent.id)[:8]}"


def build_tool_schema(agent: Agent) -> dict:
    """OpenAI function-calling shape (litellm normalizes this for whichever
    provider — Anthropic or Ollama — actually receives the call)."""
    description = f"Delegate a task to {agent.name}, a {agent.role}."
    soul = read_soul(agent)
    if soul:
        first_line = next((line.strip() for line in soul.splitlines() if line.strip()), "")
        if first_line and not first_line.startswith("#"):
            description += f" {first_line}"
    return {
        "type": "function",
        "function": {
            "name": f"delegate_to_{slugify_tool_name(agent)}",
            "description": description,
            "parameters": {
                "type": "object",
                "properties": {
                    "brief": {
                        "type": "string",
                        "description": (
                            "What you want this teammate to do — include enough "
                            "context for them to act without asking follow-up questions."
                        ),
                    }
                },
                "required": ["brief"],
            },
        },
    }


async def get_collaborators(session: AsyncSession, agent: Agent) -> list[Agent]:
    """The teammates `agent` is explicitly allowed to delegate to."""
    ids = list(
        (
            await session.execute(
                select(AgentCollaborator.collaborator_agent_id).where(
                    AgentCollaborator.agent_id == agent.id
                )
            )
        )
        .scalars()
        .all()
    )
    if not ids:
        return []
    return list(
        (await session.execute(select(Agent).where(Agent.id.in_(ids)))).scalars().all()
    )


async def build_tools_for_agent(
    session: AsyncSession, agent: Agent
) -> tuple[list[dict], dict[str, Agent]]:
    """Tool schemas for `agent`'s roster, plus a tool-name -> Agent lookup
    the caller's tool_executor uses to resolve a call back to a target.
    Returns ([], {}) — the common case — for CLI-engine agents and for any
    agent with no collaborators, so the tool-loop never activates unless
    it's actually needed.
    """
    if agent.engine_type != "api":
        return [], {}
    collaborators = await get_collaborators(session, agent)
    if not collaborators:
        return [], {}
    tools = [build_tool_schema(c) for c in collaborators]
    by_name = {tool["function"]["name"]: c for tool, c in zip(tools, collaborators, strict=True)}
    return tools, by_name
