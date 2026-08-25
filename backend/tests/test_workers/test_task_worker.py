"""Tests for the async task-execution logic behind the Celery task.

These call `_execute_task_async` directly (never through Celery's broker),
with `get_engine` monkeypatched to a stub engine, so they're fast and don't
require a running worker or real model credentials.
"""

import json
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.base import EngineResult
from app.models.agent import Agent
from app.models.task import Task
from app.workers import task_worker as task_worker_module


class _NoCloseSessionCM:
    """Wraps an existing AsyncSession so `async with ...` doesn't close it.

    `_execute_task_async` opens its session via `async with
    async_session_factory() as session`, which calls `session.close()` on
    exit. Tests need the shared, rollback-wrapped `db_session` fixture to
    stay open across that call, so this proxy no-ops the close.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *exc_info: object) -> bool:
        return False


class _StubEngine:
    def __init__(self, result: EngineResult | None = None, error: Exception | None = None) -> None:
        self._result = result
        self._error = error

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        if self._error:
            raise self._error
        return self._result


class _RecordingDelay:
    """Stands in for a Celery task object, recording `.delay(...)` calls
    instead of actually publishing to the broker — mirrors how
    `emit_celebration` is monkeypatched to a plain recorder below, and
    avoids adding another stray real-Celery-enqueue during tests."""

    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def delay(self, *args: object) -> None:
        self.calls.append(args)


async def _make_agent_and_task(db_session: AsyncSession) -> tuple[Agent, Task]:
    task = Task(title="t", brief="do it", assigned_agents=[])
    db_session.add(task)
    await db_session.flush()

    agent = Agent(
        name="Ravi",
        role="Dev",
        engine_type="cli",
        engine_provider="claude_code",
        personality_traits=["workaholic"],
    )
    db_session.add(agent)
    await db_session.flush()

    task.assigned_agents = [agent.id]
    await db_session.flush()
    return agent, task


async def test_execute_task_success_updates_task_and_agent(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)

    stub = _StubEngine(result=EngineResult(output="all done", tokens_used=10, cost_usd=0.01))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    celebrated: list[str] = []
    monkeypatch.setattr(task_worker_module, "emit_celebration", celebrated.append)
    dialogue_calls = _RecordingDelay()
    monkeypatch.setattr(task_worker_module, "generate_and_emit_dialogue", dialogue_calls)

    await task_worker_module._execute_task_async(task.id)

    await db_session.refresh(task)
    await db_session.refresh(agent)
    assert task.status == "completed"
    assert task.result_raw == "all done"
    assert task.tokens_used == 10
    assert agent.status == "idle"
    assert agent.current_task_id is None
    assert celebrated == [str(agent.id)]
    assert len(dialogue_calls.calls) == 2  # work-start, then work-done
    assert dialogue_calls.calls[0][0] == str(agent.id)
    assert dialogue_calls.calls[1][0] == str(agent.id)


async def test_execute_task_engine_failure_marks_task_failed(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)

    stub = _StubEngine(error=RuntimeError("boom"))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    celebrated: list[str] = []
    monkeypatch.setattr(task_worker_module, "emit_celebration", celebrated.append)
    dialogue_calls = _RecordingDelay()
    monkeypatch.setattr(task_worker_module, "generate_and_emit_dialogue", dialogue_calls)

    await task_worker_module._execute_task_async(task.id)

    await db_session.refresh(task)
    await db_session.refresh(agent)
    assert task.status == "failed"
    assert "boom" in task.result_raw
    assert agent.status == "idle"
    assert celebrated == []
    assert len(dialogue_calls.calls) == 1  # work-start only, no work-done on failure


async def test_execute_task_missing_task_is_noop(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._execute_task_async(uuid.uuid4())  # should not raise


# ---- route_task / multi-agent routing -------------------------------------


async def _make_boss_and_team(db_session: AsyncSession) -> tuple[Agent, Agent, Task]:
    boss = Agent(
        name="Michael", role="Manager", engine_type="cli", engine_provider="claude_code",
        personality_traits=["organized"],
    )
    teammate = Agent(
        name="Jim", role="Sales", engine_type="cli", engine_provider="claude_code",
        personality_traits=["laid_back"],
    )
    db_session.add_all([boss, teammate])
    await db_session.flush()

    task = Task(
        title="Plan the Q3 push",
        brief="Figure out the Q3 sales push",
        assigned_agents=[boss.id],
        orchestrator_agent_id=boss.id,
    )
    db_session.add(task)
    await db_session.flush()
    return boss, teammate, task


def test_parse_subtasks_extracts_json_wrapped_in_prose() -> None:
    roster = {"a1": object(), "a2": object()}
    raw = 'Sure thing! Here you go:\n[{"agent_id": "a1", "title": "t1", "brief": "b1"}]\nHope that helps!'

    result = task_worker_module._parse_subtasks(raw, roster)

    assert result == [{"agent_id": "a1", "title": "t1", "brief": "b1"}]


def test_parse_subtasks_rejects_unknown_agent_id() -> None:
    roster = {"a1": object()}
    raw = '[{"agent_id": "not-in-roster", "title": "t1", "brief": "b1"}]'

    assert task_worker_module._parse_subtasks(raw, roster) is None


def test_parse_subtasks_rejects_non_list() -> None:
    roster = {"a1": object()}

    assert task_worker_module._parse_subtasks('{"agent_id": "a1"}', roster) is None
    assert task_worker_module._parse_subtasks("not json at all", roster) is None
    assert task_worker_module._parse_subtasks("[]", roster) is None


async def test_route_task_creates_child_tasks_for_valid_decomposition(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    boss, teammate, task = await _make_boss_and_team(db_session)

    decomposition = json.dumps(
        [{"agent_id": str(teammate.id), "title": "Draft the pitch", "brief": "Write the pitch deck"}]
    )
    stub = _StubEngine(result=EngineResult(output=decomposition, raw_output=decomposition))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    execute_calls = _RecordingDelay()
    monkeypatch.setattr(task_worker_module, "execute_task", execute_calls)

    await task_worker_module._route_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "routed"
    child_ids = task.result_structured["child_task_ids"]
    assert len(child_ids) == 1

    child = await db_session.get(Task, uuid.UUID(child_ids[0]))
    assert child.title == "Draft the pitch"
    assert child.assigned_agents == [teammate.id]
    assert child.orchestrator_agent_id == boss.id
    assert child.status == "pending"
    assert execute_calls.calls == [(child_ids[0],)]


async def test_route_task_falls_back_to_single_subtask_on_bad_json(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    boss, _teammate, task = await _make_boss_and_team(db_session)

    stub = _StubEngine(result=EngineResult(output="not json", raw_output="not json"))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    execute_calls = _RecordingDelay()
    monkeypatch.setattr(task_worker_module, "execute_task", execute_calls)

    await task_worker_module._route_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "routed"
    child_ids = task.result_structured["child_task_ids"]
    assert len(child_ids) == 1

    child = await db_session.get(Task, uuid.UUID(child_ids[0]))
    assert child.assigned_agents == [boss.id]
    assert child.brief == task.brief
    assert len(execute_calls.calls) == 1


async def test_route_task_falls_back_when_engine_raises(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    boss, _teammate, task = await _make_boss_and_team(db_session)

    stub = _StubEngine(error=RuntimeError("engine unavailable"))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    execute_calls = _RecordingDelay()
    monkeypatch.setattr(task_worker_module, "execute_task", execute_calls)

    await task_worker_module._route_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "routed"
    assert len(task.result_structured["child_task_ids"]) == 1


async def test_route_task_without_orchestrator_marks_failed(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    task = Task(title="t", brief="do it", assigned_agents=[])
    db_session.add(task)
    await db_session.flush()

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._route_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "failed"


async def test_route_task_missing_orchestrator_agent_marks_failed(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    task = Task(title="t", brief="do it", assigned_agents=[], orchestrator_agent_id=uuid.uuid4())
    db_session.add(task)
    await db_session.flush()

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._route_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "failed"
