"""A minimal per-agent mailbox: when a boss agent delegates a subtask, the
specialist gets a small note about it waiting in their own workspace, read
and archived the next time they actually run a task.

Deliberately not a general multi-agent messaging bus — single producer
(route_task), single consumer (the next execute_task run for that agent),
no acks/replies/routing beyond that. If Cubicle ever needs real agent-to
-agent conversation, build that as its own thing; this just closes the gap
where a delegated subtask arrived with zero context about why.
"""

import json
import os
import uuid
from dataclasses import dataclass

import structlog

from app.models.agent import Agent
from app.models.task import Task
from app.utils.workspace import WorkspacePathError, resolve_workspace_path

logger = structlog.get_logger()


@dataclass
class DelegationNotice:
    parent_task_id: str
    parent_title: str
    parent_brief: str
    child_task_id: str
    brief: str


def write_delegation_notice(agent: Agent, parent: Task, child: Task) -> None:
    """Drop a JSON note in `agent`'s workspace `inbox/` describing why
    `child` was delegated to them. Sync (matches the existing sync
    os.makedirs precedent in claude_code.py) — best-effort: an agent whose
    workspace isn't ready yet just doesn't get a notice, it doesn't block
    routing.
    """
    try:
        resolved = resolve_workspace_path(agent.working_directory, "inbox")
    except WorkspacePathError as exc:
        logger.warning(
            "inbox_write_skipped", agent_id=str(agent.id), reason=str(exc)
        )
        return

    os.makedirs(resolved.absolute, exist_ok=True)
    notice = DelegationNotice(
        parent_task_id=str(parent.id),
        parent_title=parent.title,
        parent_brief=parent.brief,
        child_task_id=str(child.id),
        brief=child.brief,
    )
    target = os.path.join(resolved.absolute, f"{child.id}.json")
    tmp_path = f"{target}.{uuid.uuid4().hex}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(notice.__dict__, f)
    os.replace(tmp_path, target)  # atomic on POSIX and Windows


def read_and_archive_inbox(agent: Agent) -> list[dict]:
    """Read every unread inbox notice for `agent`, moving each to
    `inbox/.done/` so it's never processed twice. Returns [] (never raises)
    for an agent with no workspace, no inbox, or a corrupt entry — this is
    a best-effort context boost for the prompt, not something a task should
    fail over.
    """
    try:
        resolved = resolve_workspace_path(agent.working_directory, "inbox")
    except WorkspacePathError:
        return []
    if not os.path.isdir(resolved.absolute):
        return []

    done_dir = os.path.join(resolved.absolute, ".done")
    notices: list[dict] = []
    with os.scandir(resolved.absolute) as it:
        entries = [e for e in it if e.is_file() and e.name.endswith(".json")]
    for entry in entries:
        try:
            with open(entry.path, encoding="utf-8") as f:
                notices.append(json.load(f))
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("inbox_read_skipped_bad_entry", path=entry.path, error=str(exc))
            continue
        os.makedirs(done_dir, exist_ok=True)
        os.replace(entry.path, os.path.join(done_dir, entry.name))
    return notices


def format_inbox_context(notices: list[dict]) -> str:
    """Render inbox notices as a prompt-ready block. Empty string if none —
    callers should skip prepending anything in that case."""
    if not notices:
        return ""
    blocks = [
        f"- From your orchestrator's task \"{n.get('parent_title', '')}\": "
        f"{n.get('parent_brief', '')}"
        for n in notices
    ]
    return (
        "You were delegated the following by your orchestrator:\n\n"
        + "\n".join(blocks)
        + "\n\n---\n\n"
    )
