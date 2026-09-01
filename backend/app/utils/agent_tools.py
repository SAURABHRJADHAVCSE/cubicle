"""Builds the OpenAI-style function-calling tool list for litellm.acompletion():
delegate-to-teammate tools from an agent's explicit AgentCollaborator roster,
plus built-in generate_image/generate_video tools when a media provider is
actually configured for the agent (see media/registry.py). Only API-engine
agents get any tools at all — CLI-subprocess engines have no structured
tool-calling protocol Cubicle can hook into, so build_tools_for_agent()
returns nothing for them rather than assuming the caller already checked.
"""

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.media.registry import get_image_generator, get_video_generator
from app.models.agent import Agent
from app.models.agent_collaborator import AgentCollaborator
from app.utils.soul import read_soul
from app.utils.time_context import current_date_line

_SLUG_INVALID = re.compile(r"[^a-zA-Z0-9_-]+")
_MAX_SLUG_LEN = 40

# Fixed tool names (not per-agent, unlike delegate_to_* names) — the
# tool_executor built in workers/task_worker.py's make_tool_executor
# branches on these directly, checked before the delegate-name lookup.
GENERATE_IMAGE_TOOL = "generate_image"
GENERATE_VIDEO_TOOL = "generate_video"


def _media_tool_schema(name: str, description: str) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "A detailed description of what to generate.",
                    }
                },
                "required": ["prompt"],
            },
        },
    }


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
    """The teammates `agent`'s owner has explicitly curated in its Team
    panel. No longer what gates delegate-tool availability (see
    get_delegation_candidates below) — kept for the Team panel's own API
    routes (api/agents.py), which still read/write this roster for display.
    """
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


async def get_delegation_candidates(session: AsyncSession, agent: Agent) -> list[Agent]:
    """Every other agent in the roster — build_tools_for_agent's source of
    delegate-to-teammate tools.

    Deliberately NOT scoped to the curated AgentCollaborator roster
    (get_collaborators above): an agent should be able to hand a task to
    whichever teammate actually fits it based on role/expertise, not only
    whoever happened to get checked in the Team panel — a fixed, hand-picked
    target is exactly what let a chat agent either fail silently or fabricate
    a delegation it never made. The model still has to *choose* the right
    tool itself, from each candidate's name/role/soul-derived description
    (see build_tool_schema) — this only widens who's a legal target.
    Cycle/depth protection (make_tool_executor's call_chain check,
    max_orchestration_depth) is unchanged and applies regardless of how the
    tool list was built, so a wider roster doesn't risk infinite loops.
    """
    return list(
        (
            await session.execute(select(Agent).where(Agent.id != agent.id))
        )
        .scalars()
        .all()
    )


async def build_tools_for_agent(
    session: AsyncSession, agent: Agent
) -> tuple[list[dict], dict[str, Agent]]:
    """Tool schemas for `agent`: delegate-to-teammate tools (one per other
    agent in the roster — see get_delegation_candidates) plus built-in
    generate_image/generate_video tools when a media provider actually
    resolves for this agent (see media/registry.py — an agent's own Gemini
    key or the global setting). Returns ([], {}) for CLI-engine agents,
    which have no structured tool-calling protocol Cubicle can hook into at
    all. The second return value is only the delegate-name -> Agent lookup;
    media tool names are fixed constants (GENERATE_IMAGE_TOOL/
    GENERATE_VIDEO_TOOL above), not per-agent, so they don't need one — the
    tool-loop never activates for an agent alone in the roster with no
    configured media provider either.
    """
    if agent.engine_type != "api":
        return [], {}

    collaborators = await get_delegation_candidates(session, agent)
    tools = [build_tool_schema(c) for c in collaborators]
    by_name = {tool["function"]["name"]: c for tool, c in zip(tools, collaborators, strict=True)}

    if await get_image_generator(agent, session) is not None:
        tools.append(
            _media_tool_schema(GENERATE_IMAGE_TOOL, "Generate an image from a text description.")
        )
    if await get_video_generator(agent, session) is not None:
        tools.append(
            _media_tool_schema(
                GENERATE_VIDEO_TOOL, "Generate a short video from a text description."
            )
        )

    return tools, by_name


def build_agent_system_prompt(agent: Agent, tools: list[dict]) -> str:
    """Identity + SOUL.md + tool-honesty guardrails, shared by the task path
    (workers/task_worker.py) and live chat (api/chat.py) so an agent's
    framing doesn't silently differ between the two surfaces — chat used to
    get no system prompt at all, which let it fabricate having delegated a
    task instead of actually calling the delegate tool it had available.
    """
    system_prompt = f"You are {agent.name}, a {agent.role}. {current_date_line()}"
    soul = read_soul(agent)
    if soul:
        system_prompt += f"\n\n{soul}"

    has_media_tool = any(
        t["function"]["name"] in (GENERATE_IMAGE_TOOL, GENERATE_VIDEO_TOOL) for t in tools
    )
    if not has_media_tool:
        # Without this, the model free-associates a plausible-sounding reply
        # and fabricates having created a real file — confirmed live.
        system_prompt += (
            "\n\nYou have no way to actually generate an image, video, or any "
            "other media file right now — never claim to have created one. If "
            "asked, say plainly that media generation isn't set up for you."
        )
    delegate_tools = [
        t for t in tools if t["function"]["name"] not in (GENERATE_IMAGE_TOOL, GENERATE_VIDEO_TOOL)
    ]
    if delegate_tools:
        # Each delegate_to_* tool's description names the teammate and their
        # role (see build_tool_schema) — the model has everything it needs
        # to judge fit, but without an explicit instruction to actually
        # reason about it, it tends to just pick whichever one it mentioned
        # most recently, or the first one listed, rather than the teammate
        # who's actually the domain expert for the specific request.
        system_prompt += (
            "\n\nYou can delegate to any teammate listed among your tools — "
            "read each one's description (their name and role) and pick "
            "whichever teammate is the actual domain expert for what's being "
            "asked, not just the first or most familiar option. If none of "
            "them fit the request, say so plainly instead of delegating to "
            "the closest-sounding one anyway. When you've identified the "
            "right teammate, delegate to them immediately in the same turn "
            "— do not ask the user for permission or confirmation first; "
            "delegating is a reversible, low-stakes action, not one that "
            "needs sign-off."
        )
    if tools:
        # Without this, a model asked to do something it can't do directly
        # but *could* hand off (e.g. it has no media tool but has a teammate
        # who does) will sometimes narrate a plausible-sounding action in
        # prose — "I've delegated this to Wanda" — without ever making the
        # matching tool call. Confirmed live: no task was actually created.
        system_prompt += (
            "\n\nWhen one of your available tools (delegating to a teammate, "
            "generating media, etc.) can accomplish what's being asked, "
            "actually call that tool. Never write prose claiming you did "
            "something — delegated a task, generated a file — without making "
            "the matching tool call first."
        )
    return system_prompt
