"""Tests for the per-agent SOUL.md (app/utils/soul.py)."""

import uuid

import pytest

from app.models.agent import Agent
from app.utils.soul import default_soul_content, read_soul, write_soul
from app.utils.workspace import WorkspacePathError


def _agent(working_directory: str | None, name: str = "Jim", role: str = "Sales") -> Agent:
    return Agent(
        id=uuid.uuid4(),
        name=name,
        role=role,
        engine_type="cli",
        engine_provider="claude_code",
        working_directory=working_directory,
        personality_traits=[],
    )


def test_default_soul_content_contains_name_and_role():
    agent = _agent(None, name="Priya", role="Screener")
    content = default_soul_content(agent)
    assert "Priya" in content
    assert "Screener" in content


def test_write_then_read_round_trip(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    agent = _agent(str(workspace))

    write_soul(agent, "# Custom soul\n\nBe extra thorough.")

    assert (workspace / "SOUL.md").read_text() == "# Custom soul\n\nBe extra thorough."
    assert read_soul(agent) == "# Custom soul\n\nBe extra thorough."


def test_write_soul_overwrites_existing_content(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    agent = _agent(str(workspace))

    write_soul(agent, "first version")
    write_soul(agent, "second version")

    assert read_soul(agent) == "second version"


def test_read_soul_returns_none_for_missing_workspace():
    agent = _agent(None)
    assert read_soul(agent) is None


def test_read_soul_returns_none_when_file_not_yet_written(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    agent = _agent(str(workspace))

    assert read_soul(agent) is None


def test_write_soul_raises_for_missing_workspace():
    # Deliberately diverges from inbox.py's fail-soft writes (see soul.py's
    # module docstring): a direct user save action must surface failure as
    # a real error, not silently do nothing.
    agent = _agent(None)
    with pytest.raises(WorkspacePathError):
        write_soul(agent, "anything")
