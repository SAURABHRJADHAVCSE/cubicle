"""Tests for the per-agent delegation-notice mailbox (app/utils/inbox.py)."""

import json
import os
import uuid

from app.models.agent import Agent
from app.models.task import Task
from app.utils.inbox import format_inbox_context, read_and_archive_inbox, write_delegation_notice


def _agent(working_directory: str) -> Agent:
    return Agent(
        id=uuid.uuid4(),
        name="Jim",
        role="Sales",
        engine_type="cli",
        engine_provider="claude_code",
        working_directory=working_directory,
        personality_traits=[],
    )


def _task(**kwargs) -> Task:
    defaults = dict(id=uuid.uuid4(), title="t", brief="do it", assigned_agents=[])
    defaults.update(kwargs)
    return Task(**defaults)


def test_write_then_read_and_archive_round_trip(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    agent = _agent(str(workspace))
    parent = _task(title="Plan the launch", brief="Ship it")
    child = _task(title="Draft the pitch", brief="Write the pitch deck")

    write_delegation_notice(agent, parent, child)

    notice_path = workspace / "inbox" / f"{child.id}.json"
    assert notice_path.exists()
    on_disk = json.loads(notice_path.read_text())
    assert on_disk["parent_title"] == "Plan the launch"
    assert on_disk["brief"] == "Write the pitch deck"

    notices = read_and_archive_inbox(agent)
    assert len(notices) == 1
    assert notices[0]["child_task_id"] == str(child.id)

    # Archived, not left in place — never processed twice.
    assert not notice_path.exists()
    assert (workspace / "inbox" / ".done" / f"{child.id}.json").exists()

    assert read_and_archive_inbox(agent) == []


def test_read_and_archive_returns_empty_list_for_missing_workspace():
    agent = _agent(None)
    assert read_and_archive_inbox(agent) == []


def test_read_and_archive_skips_unparseable_entry(tmp_path):
    workspace = tmp_path / "ws"
    inbox = workspace / "inbox"
    inbox.mkdir(parents=True)
    (inbox / "corrupt.json").write_text("not json")
    agent = _agent(str(workspace))

    assert read_and_archive_inbox(agent) == []
    # Left in place rather than archived, since it was never successfully read.
    assert (inbox / "corrupt.json").exists()


def test_write_delegation_notice_is_a_noop_for_missing_workspace():
    agent = _agent(None)
    parent = _task()
    child = _task()

    write_delegation_notice(agent, parent, child)  # should not raise


def test_format_inbox_context_empty_and_populated():
    assert format_inbox_context([]) == ""

    rendered = format_inbox_context(
        [{"parent_title": "Plan the launch", "parent_brief": "Ship it"}]
    )
    assert "Plan the launch" in rendered
    assert "Ship it" in rendered
    assert rendered.endswith("---\n\n")
