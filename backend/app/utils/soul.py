"""Per-agent SOUL.md — a real markdown file at the root of an agent's
workspace defining its identity/personality/behavioral rules, loaded into
the model's context on every task (see task_worker.py). Inspired by the
OpenClaw agent framework's SOUL.md concept.

Mirrors app/utils/inbox.py's conventions (sync functions, resolve_workspace_
path, atomic os.replace writes) with one deliberate divergence: inbox writes
are a best-effort background side-channel, so failing silently is correct
there. write_soul() here has two callers with different needs — agent
creation wants best-effort (a workspace hiccup shouldn't block creating the
agent), the PUT /agents/{id}/soul endpoint is a direct user save action that
must surface failure as a real error. So write_soul() itself raises
WorkspacePathError and lets each caller decide how to handle it.
"""

import os
import uuid

import structlog

from app.models.agent import Agent
from app.utils.workspace import WorkspacePathError, resolve_workspace_path

logger = structlog.get_logger()

SOUL_FILENAME = "SOUL.md"


def default_soul_content(agent: Agent) -> str:
    """A sensible starting point, editable at creation time and any time
    after via the Command Center's file browser."""
    return f"""# {agent.name}

## Core Identity

This is your SOUL.md — it's loaded into your context on every task, on top of your
role ({agent.role}), which is already set separately and doesn't need repeating here.
Use this file for the part your role doesn't cover: personality, working style,
standards you hold yourself to. Edits (yours or a human teammate's) take effect on
your very next task; nothing needs to be restarted.

## Responsibilities

- When a brief is ambiguous, make a reasonable call and say what you assumed, rather
  than guessing silently or stalling.
- Keep changes scoped to what the task actually asked for.

## Behavioral Guidelines

**Do:**
- Explain your reasoning briefly when a decision isn't obvious.
- Flag risks, tradeoffs, or things you're unsure about instead of hiding them.
- Follow the existing patterns and conventions already present in a workspace over
  inventing new ones.

**Don't:**
- Don't invent facts, or claim to have done something you didn't actually do.
- Don't touch files or systems outside of what the task requires.
- Don't repeat a mistake you've already made — check what you've learned from past
  tasks first.

## Notes

This file lives at the root of your workspace as a plain markdown file — edit it
directly, or through the Command Center's file browser. There's no need to keep any
particular section; rewrite this however best describes how you should work.
"""


def write_soul(agent: Agent, content: str) -> None:
    """Write SOUL.md for `agent`. Raises WorkspacePathError if the
    workspace root doesn't exist — callers decide how to handle that
    (best-effort during creation vs. a real error from the save endpoint)."""
    resolved = resolve_workspace_path(agent.working_directory, SOUL_FILENAME)
    tmp_path = f"{resolved.absolute}.{uuid.uuid4().hex}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp_path, resolved.absolute)  # atomic on POSIX and Windows


def read_soul(agent: Agent) -> str | None:
    """Read SOUL.md for `agent`, or None if there isn't one yet — fail-soft,
    same as inbox.py's reads: this is context enrichment, not something a
    task should fail over."""
    try:
        resolved = resolve_workspace_path(agent.working_directory, SOUL_FILENAME)
    except WorkspacePathError:
        return None
    if not os.path.isfile(resolved.absolute):
        return None
    try:
        with open(resolved.absolute, encoding="utf-8") as f:
            return f.read()
    except (OSError, UnicodeDecodeError) as exc:
        logger.warning("soul_read_failed", agent_id=str(agent.id), error=str(exc))
        return None
