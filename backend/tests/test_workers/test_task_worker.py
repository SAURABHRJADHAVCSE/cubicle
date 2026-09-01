"""Tests for the async task-execution logic behind the Celery task.

These call `_execute_task_async` directly (never through Celery's broker),
with `get_engine` monkeypatched to a stub engine, so they're fast and don't
require a running worker or real model credentials.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.base import EngineResult
from app.models.agent import Agent
from app.models.task import Task
from app.workers import task_worker as task_worker_module


async def _no_memories(*args: object, **kwargs: object) -> list[str]:
    return []


@pytest.fixture(autouse=True)
def _mock_memory_search(monkeypatch: pytest.MonkeyPatch) -> None:
    # get_relevant_memories() now runs on every _execute_task_async call —
    # without this, ~20 existing tests below would attempt a real embedding
    # call against host.docker.internal:11434, unreachable in the test
    # environment. Mirrors test_chat.py's exact existing pattern for the
    # same function. Tests that want to verify memory injection specifically
    # override this per-test with their own monkeypatch.setattr call.
    monkeypatch.setattr(task_worker_module, "get_relevant_memories", _no_memories)


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
        self.captured_prompt: str | None = None
        self.captured_context: dict | None = None

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        self.captured_prompt = prompt
        self.captured_context = context
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
    # A real store_memory.delay() here would enqueue a genuine Celery
    # message referencing this test's rolled-back-at-teardown task id — the
    # real worker later chokes on it with a FK violation, since Postgres's
    # rollback and Redis's already-published message aren't transactional
    # with each other. Same reasoning applies everywhere else in this file
    # that reaches this success path.
    monkeypatch.setattr(task_worker_module, "store_memory", _RecordingDelay())

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


async def test_execute_task_folds_soul_and_memory_into_system_prompt(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession, tmp_path
) -> None:
    workspace = tmp_path / "ws"
    workspace.mkdir()
    (workspace / "SOUL.md").write_text("Always double-check your math.")

    task = Task(title="t", brief="do it", assigned_agents=[])
    db_session.add(task)
    await db_session.flush()
    agent = Agent(
        name="Ravi", role="Dev", engine_type="cli", engine_provider="claude_code",
        working_directory=str(workspace), personality_traits=[],
    )
    db_session.add(agent)
    await db_session.flush()
    task.assigned_agents = [agent.id]
    await db_session.flush()

    stub = _StubEngine(result=EngineResult(output="ok", tokens_used=1, cost_usd=0.0))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    monkeypatch.setattr(task_worker_module, "emit_celebration", lambda *_: None)
    monkeypatch.setattr(task_worker_module, "generate_and_emit_dialogue", _RecordingDelay())
    monkeypatch.setattr(task_worker_module, "store_memory", _RecordingDelay())

    async def fake_memories(session, agent, query, limit=5):
        return ["Once forgot to handle the empty-list case."]

    monkeypatch.setattr(task_worker_module, "get_relevant_memories", fake_memories)

    await task_worker_module._execute_task_async(task.id)

    assert stub.captured_context is not None
    system_prompt = stub.captured_context["system_prompt"]
    assert "Always double-check your math." in system_prompt
    assert "Relevant past experience" in system_prompt
    assert "Once forgot to handle the empty-list case." in system_prompt


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


async def test_execute_task_short_circuits_when_cost_ceiling_exceeded(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)

    # A prior completed task in the last 24h already spent past the ceiling.
    prior = Task(
        title="prior", brief="x", assigned_agents=[agent.id],
        status="completed", cost_usd=10, completed_at=datetime.now(timezone.utc),
    )
    db_session.add(prior)
    await db_session.flush()

    fake_settings = SimpleNamespace(daily_cost_ceiling_usd=5.0)
    monkeypatch.setattr(task_worker_module, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    engine_calls: list[Agent] = []
    monkeypatch.setattr(
        task_worker_module, "get_engine", lambda a: engine_calls.append(a) or _StubEngine()
    )

    await task_worker_module._execute_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "failed"
    assert "cost ceiling" in task.result_raw.lower()
    assert engine_calls == []  # never reached the engine


async def test_execute_task_ignores_ceiling_when_unset(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)

    fake_settings = SimpleNamespace(daily_cost_ceiling_usd=None)
    monkeypatch.setattr(task_worker_module, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    stub = _StubEngine(result=EngineResult(output="ok", tokens_used=1, cost_usd=0.01))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "emit_celebration", lambda *_: None)
    monkeypatch.setattr(task_worker_module, "generate_and_emit_dialogue", _RecordingDelay())
    monkeypatch.setattr(task_worker_module, "store_memory", _RecordingDelay())

    await task_worker_module._execute_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "completed"


async def _backdate_updated_at(db_session: AsyncSession, task_id: uuid.UUID, when: datetime) -> None:
    # Raw SQL, not `task.updated_at = when`: the column's `onupdate=func.now()`
    # would just overwrite an ORM-assigned value at flush time — this is the
    # only way to actually get a stale timestamp into the row for the test.
    await db_session.execute(
        text("UPDATE tasks SET updated_at = :when WHERE id = :id"), {"when": when, "id": task_id}
    )
    await db_session.commit()


async def test_reconcile_marks_stale_in_progress_task_failed(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)
    task.status = "in_progress"
    agent.status = "working"
    agent.current_task_id = task.id
    await db_session.commit()
    from app.config import get_settings as real_get_settings

    stale_threshold = task_worker_module.ORPHAN_GRACE_SECONDS + real_get_settings().task_timeout_seconds
    await _backdate_updated_at(
        db_session, task.id, datetime.now(timezone.utc) - timedelta(seconds=stale_threshold + 60)
    )

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._reconcile_orphaned_tasks_async()

    await db_session.refresh(task)
    await db_session.refresh(agent)
    assert task.status == "failed"
    assert "orphaned" in task.result_raw.lower()
    assert agent.status == "idle"
    assert agent.current_task_id is None


async def test_reconcile_leaves_recently_updated_task_alone(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)
    task.status = "in_progress"
    await db_session.commit()
    # Not backdated — updated_at is "now", well inside the grace window.

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._reconcile_orphaned_tasks_async()

    await db_session.refresh(task)
    assert task.status == "in_progress"  # untouched — still plausibly running


async def test_reconcile_catches_stale_assigned_task_too(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)
    task.status = "assigned"  # dispatched but never actually started
    await db_session.commit()
    await _backdate_updated_at(
        db_session, task.id, datetime.now(timezone.utc) - timedelta(seconds=10_000)
    )

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._reconcile_orphaned_tasks_async()

    await db_session.refresh(task)
    assert task.status == "failed"


async def test_reconcile_ignores_terminal_and_pending_statuses(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)
    task.status = "pending"  # never dispatched at all — not this sweep's concern
    await db_session.commit()
    await _backdate_updated_at(
        db_session, task.id, datetime.now(timezone.utc) - timedelta(seconds=10_000)
    )

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._reconcile_orphaned_tasks_async()

    await db_session.refresh(task)
    assert task.status == "pending"


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


async def test_route_task_folds_orchestrator_soul_into_system_prompt(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession, tmp_path
) -> None:
    workspace = tmp_path / "boss-ws"
    workspace.mkdir()
    (workspace / "SOUL.md").write_text("Delegate ruthlessly; never do the work yourself.")

    boss = Agent(
        name="Michael", role="Manager", engine_type="cli", engine_provider="claude_code",
        working_directory=str(workspace), personality_traits=[],
    )
    teammate = Agent(
        name="Jim", role="Sales", engine_type="cli", engine_provider="claude_code",
        personality_traits=[],
    )
    db_session.add_all([boss, teammate])
    await db_session.flush()
    task = Task(
        title="Plan the Q3 push", brief="Figure out the Q3 sales push",
        assigned_agents=[boss.id], orchestrator_agent_id=boss.id,
    )
    db_session.add(task)
    await db_session.flush()

    decomposition = json.dumps(
        [{"agent_id": str(teammate.id), "title": "Draft the pitch", "brief": "Write the pitch deck"}]
    )
    stub = _StubEngine(result=EngineResult(output=decomposition, raw_output=decomposition))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    monkeypatch.setattr(task_worker_module, "execute_task", _RecordingDelay())

    await task_worker_module._route_task_async(task.id)

    assert stub.captured_context is not None
    assert "Delegate ruthlessly; never do the work yourself." in stub.captured_context["system_prompt"]


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


async def _make_routed_parent_with_children(
    db_session: AsyncSession, n: int = 2
) -> tuple[Task, list[tuple[Agent, Task]]]:
    parent = Task(title="Plan the launch", brief="Ship it", assigned_agents=[], status="routed")
    db_session.add(parent)
    await db_session.flush()

    pairs: list[tuple[Agent, Task]] = []
    for i in range(n):
        agent = Agent(
            name=f"Specialist{i}", role="Dev", engine_type="cli", engine_provider="claude_code",
            personality_traits=[],
        )
        db_session.add(agent)
        await db_session.flush()
        child = Task(
            title=f"Subtask {i}", brief=f"Do part {i}", assigned_agents=[agent.id],
            parent_task_id=parent.id, status="pending",
        )
        db_session.add(child)
        await db_session.flush()
        pairs.append((agent, child))

    parent.result_structured = {"child_task_ids": [str(c.id) for _, c in pairs]}
    await db_session.commit()
    return parent, pairs


async def test_parent_completes_once_all_children_finish(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    parent, pairs = await _make_routed_parent_with_children(db_session, n=2)
    (agent1, child1), (agent2, child2) = pairs

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    monkeypatch.setattr(task_worker_module, "emit_celebration", lambda *_: None)
    monkeypatch.setattr(task_worker_module, "generate_and_emit_dialogue", _RecordingDelay())
    monkeypatch.setattr(task_worker_module, "store_memory", _RecordingDelay())
    status_calls: list[tuple[str, str]] = []
    monkeypatch.setattr(
        task_worker_module, "emit_task_status", lambda tid, status: status_calls.append((tid, status))
    )

    stub = _StubEngine(result=EngineResult(output="done 1", tokens_used=1, cost_usd=0.0))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    await task_worker_module._execute_task_async(child1.id)

    await db_session.refresh(parent)
    assert parent.status == "routed"  # still waiting on child2
    assert (str(parent.id), "completed") not in status_calls

    await task_worker_module._execute_task_async(child2.id)

    await db_session.refresh(parent)
    assert parent.status == "completed"
    assert parent.completed_at is not None
    children = parent.result_structured["children"]
    assert len(children) == 2
    assert {c["status"] for c in children} == {"completed"}
    assert parent.result_structured["child_task_ids"] == [str(child1.id), str(child2.id)]  # preserved
    assert (str(parent.id), "completed") in status_calls


async def test_parent_fails_when_any_child_fails(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    parent, pairs = await _make_routed_parent_with_children(db_session, n=2)
    (agent1, child1), (agent2, child2) = pairs

    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    monkeypatch.setattr(task_worker_module, "emit_celebration", lambda *_: None)
    monkeypatch.setattr(task_worker_module, "generate_and_emit_dialogue", _RecordingDelay())
    monkeypatch.setattr(task_worker_module, "store_memory", _RecordingDelay())

    ok = _StubEngine(result=EngineResult(output="done", tokens_used=1, cost_usd=0.0))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: ok)
    await task_worker_module._execute_task_async(child1.id)

    boom = _StubEngine(error=RuntimeError("boom"))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: boom)
    await task_worker_module._execute_task_async(child2.id)

    await db_session.refresh(parent)
    assert parent.status == "failed"


async def test_parent_completion_is_idempotent_against_double_trigger(
    db_session: AsyncSession,
) -> None:
    # Simulates two siblings finishing "concurrently": both already terminal
    # before _maybe_complete_parent runs a second time for the same parent.
    parent, pairs = await _make_routed_parent_with_children(db_session, n=1)
    _agent, child = pairs[0]
    child.status = "completed"
    await db_session.commit()

    await task_worker_module._maybe_complete_parent(db_session, child)
    await db_session.refresh(parent)
    assert parent.status == "completed"
    first_completed_at = parent.completed_at

    await task_worker_module._maybe_complete_parent(db_session, child)
    await db_session.refresh(parent)
    assert parent.completed_at == first_completed_at  # not re-aggregated


async def test_route_task_writes_delegation_notice_to_child_agent_inbox(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession, tmp_path
) -> None:
    boss, teammate, task = await _make_boss_and_team(db_session)
    teammate.working_directory = str(tmp_path)
    await db_session.commit()

    decomposition = json.dumps(
        [{"agent_id": str(teammate.id), "title": "Draft the pitch", "brief": "Write the pitch deck"}]
    )
    stub = _StubEngine(result=EngineResult(output=decomposition, raw_output=decomposition))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    monkeypatch.setattr(task_worker_module, "execute_task", _RecordingDelay())

    await task_worker_module._route_task_async(task.id)

    inbox_files = list((tmp_path / "inbox").glob("*.json"))
    assert len(inbox_files) == 1
    notice = json.loads(inbox_files[0].read_text())
    assert notice["parent_brief"] == task.brief
    assert notice["brief"] == "Write the pitch deck"


async def test_dependencies_satisfied_empty_is_true(db_session: AsyncSession) -> None:
    task = Task(title="t", brief="x", assigned_agents=[])
    db_session.add(task)
    await db_session.flush()
    assert await task_worker_module.dependencies_satisfied(db_session, task) is True


async def test_dependencies_satisfied_true_when_all_completed(db_session: AsyncSession) -> None:
    dep = Task(title="dep", brief="x", assigned_agents=[], status="completed")
    db_session.add(dep)
    await db_session.flush()
    task = Task(title="t", brief="x", assigned_agents=[], depends_on=[dep.id])
    db_session.add(task)
    await db_session.flush()

    assert await task_worker_module.dependencies_satisfied(db_session, task) is True


async def test_dependencies_satisfied_false_when_one_still_pending(db_session: AsyncSession) -> None:
    dep = Task(title="dep", brief="x", assigned_agents=[], status="in_progress")
    db_session.add(dep)
    await db_session.flush()
    task = Task(title="t", brief="x", assigned_agents=[], depends_on=[dep.id])
    db_session.add(task)
    await db_session.flush()

    assert await task_worker_module.dependencies_satisfied(db_session, task) is False


async def test_dependencies_satisfied_false_for_dangling_id(db_session: AsyncSession) -> None:
    task = Task(title="t", brief="x", assigned_agents=[], depends_on=[uuid.uuid4()])
    db_session.add(task)
    await db_session.flush()

    assert await task_worker_module.dependencies_satisfied(db_session, task) is False


async def test_promote_blocked_dependents_dispatches_once_satisfied(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    dep = Task(title="dep", brief="x", assigned_agents=[], status="completed")
    db_session.add(dep)
    await db_session.flush()
    blocked = Task(
        title="blocked", brief="x", assigned_agents=[], status="blocked", depends_on=[dep.id]
    )
    db_session.add(blocked)
    await db_session.flush()

    dispatched: list[str] = []
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda tid: dispatched.append(tid))

    await task_worker_module._promote_blocked_dependents(db_session, dep)

    await db_session.refresh(blocked)
    assert blocked.status == "assigned"
    assert dispatched == [str(blocked.id)]


async def test_promote_blocked_dependents_skips_still_unsatisfied(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    dep1 = Task(title="dep1", brief="x", assigned_agents=[], status="completed")
    dep2 = Task(title="dep2", brief="x", assigned_agents=[], status="in_progress")
    db_session.add_all([dep1, dep2])
    await db_session.flush()
    blocked = Task(
        title="blocked", brief="x", assigned_agents=[], status="blocked",
        depends_on=[dep1.id, dep2.id],
    )
    db_session.add(blocked)
    await db_session.flush()

    dispatched: list[str] = []
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda tid: dispatched.append(tid))

    await task_worker_module._promote_blocked_dependents(db_session, dep1)

    await db_session.refresh(blocked)
    assert blocked.status == "blocked"  # dep2 still not done
    assert dispatched == []


async def test_route_task_short_circuits_when_cost_ceiling_exceeded(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    boss, _teammate, task = await _make_boss_and_team(db_session)

    prior = Task(
        title="prior", brief="x", assigned_agents=[boss.id],
        status="completed", cost_usd=10, completed_at=datetime.now(timezone.utc),
    )
    db_session.add(prior)
    await db_session.flush()

    fake_settings = SimpleNamespace(daily_cost_ceiling_usd=5.0)
    monkeypatch.setattr(task_worker_module, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    engine_calls: list[Agent] = []
    monkeypatch.setattr(
        task_worker_module, "get_engine", lambda a: engine_calls.append(a) or _StubEngine()
    )

    await task_worker_module._route_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "failed"
    assert engine_calls == []
    # No agent= was passed to _mark_failed here (see task_worker.py's own
    # comment) since _route_task_async never puts the orchestrator into a
    # "working" state in the first place — nothing to reset back to idle.
    await db_session.refresh(boss)
    assert boss.status == "idle"


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


async def test_maybe_complete_parent_ignores_non_routed_parent(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    """Regression test for the agents-as-tools delegation fix: a delegation
    child also sets parent_task_id, but the "parent" there is a task whose
    own engine call is still running (status "in_progress", not "routed")
    — _maybe_complete_parent must leave it alone, not complete it out from
    under its own still-running execution."""
    parent = Task(title="Delegator", brief="x", assigned_agents=[], status="in_progress")
    db_session.add(parent)
    await db_session.flush()
    child = Task(
        title="Delegated", brief="x", assigned_agents=[], parent_task_id=parent.id,
        status="completed",
    )
    db_session.add(child)
    await db_session.commit()

    status_calls: list[tuple[str, str]] = []
    monkeypatch.setattr(
        task_worker_module, "emit_task_status", lambda tid, status: status_calls.append((tid, status))
    )

    await task_worker_module._maybe_complete_parent(db_session, child)

    await db_session.refresh(parent)
    assert parent.status == "in_progress"  # untouched
    assert status_calls == []


# ---- agents-as-tools delegation (make_tool_executor) ----------------------


class _StubToolCallingEngine:
    """A stub engine that, given a tool_executor in its context, calls it
    once with a fixed name/args — simulates an orchestrator LLM deciding to
    delegate, without needing a real litellm tool loop (that's covered
    separately in test_engines/test_litellm_engine.py)."""

    def __init__(self, tool_name: str, tool_args: dict, final_output: str = "orchestrated") -> None:
        self.tool_name = tool_name
        self.tool_args = tool_args
        self.final_output = final_output
        self.captured_context: dict | None = None

    async def execute(self, prompt: str, context: dict) -> EngineResult:
        self.captured_context = context
        tool_executor = context.get("tool_executor")
        if tool_executor is None:
            return EngineResult(output=self.final_output, tokens_used=1, cost_usd=0.0)
        content, is_error = await tool_executor(self.tool_name, self.tool_args)
        return EngineResult(
            output=f"{self.final_output}: {content}", tokens_used=1, cost_usd=0.0
        )


async def test_delegation_creates_and_completes_child_task(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    main = Agent(
        name="Manager", role="Boss", engine_type="api", engine_provider="anthropic",
        personality_traits=[],
    )
    teammate = Agent(
        name="Artist", role="Image Gen", engine_type="cli", engine_provider="claude_code",
        personality_traits=[],
    )
    db_session.add_all([main, teammate])
    await db_session.flush()
    task = Task(title="Make a post", brief="do it", assigned_agents=[main.id])
    db_session.add(task)
    await db_session.flush()

    async def fake_build_tools(session, agent):
        if agent.id == main.id:
            return (
                [{"type": "function", "function": {"name": "delegate_to_artist"}}],
                {"delegate_to_artist": teammate},
            )
        return [], {}

    monkeypatch.setattr(task_worker_module, "build_tools_for_agent", fake_build_tools)

    stub_teammate = _StubEngine(
        result=EngineResult(output="a cute cat drawing", tokens_used=2, cost_usd=0.02)
    )
    stub_main = _StubToolCallingEngine("delegate_to_artist", {"brief": "draw a cat"})
    monkeypatch.setattr(
        task_worker_module, "get_engine", lambda a: stub_main if a.id == main.id else stub_teammate
    )
    monkeypatch.setattr(task_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session))
    monkeypatch.setattr(task_worker_module, "emit_celebration", lambda *_: None)
    monkeypatch.setattr(task_worker_module, "generate_and_emit_dialogue", _RecordingDelay())
    monkeypatch.setattr(task_worker_module, "store_memory", _RecordingDelay())

    await task_worker_module._execute_task_async(task.id)

    await db_session.refresh(task)
    assert task.status == "completed"
    assert "a cute cat drawing" in task.result_raw

    children = list(
        (
            await db_session.execute(select(Task).where(Task.parent_task_id == task.id))
        )
        .scalars()
        .all()
    )
    assert len(children) == 1
    child = children[0]
    assert child.assigned_agents == [teammate.id]
    assert child.status == "completed"
    assert child.result_raw == "a cute cat drawing"

    await db_session.refresh(teammate)
    assert teammate.status == "idle"  # freed back up after the delegated call


async def test_make_tool_executor_rejects_unknown_tool() -> None:
    executor = task_worker_module.make_tool_executor(
        uuid.uuid4(), {}, [], Agent(id=uuid.uuid4()), []
    )
    content, is_error = await executor("delegate_to_ghost", {"brief": "x"})
    assert is_error is True
    assert "unknown tool" in content.lower()


async def test_make_tool_executor_rejects_missing_brief() -> None:
    target_id = uuid.uuid4()
    executor = task_worker_module.make_tool_executor(
        uuid.uuid4(), {"delegate_to_x": target_id}, [], Agent(id=uuid.uuid4()), []
    )
    content, is_error = await executor("delegate_to_x", {})
    assert is_error is True


async def test_make_tool_executor_rejects_cycle() -> None:
    target_id = uuid.uuid4()
    executor = task_worker_module.make_tool_executor(
        uuid.uuid4(),
        {"delegate_to_x": target_id},
        call_chain=[target_id],
        agent=Agent(id=uuid.uuid4()),
        generated_files=[],
    )
    content, is_error = await executor("delegate_to_x", {"brief": "do it"})
    assert is_error is True
    assert "cycle" in content.lower()


async def test_make_tool_executor_rejects_depth_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_settings = SimpleNamespace(max_orchestration_depth=2)
    monkeypatch.setattr(task_worker_module, "get_settings", lambda: fake_settings)
    target_id = uuid.uuid4()
    executor = task_worker_module.make_tool_executor(
        uuid.uuid4(),
        {"delegate_to_x": target_id},
        call_chain=[uuid.uuid4(), uuid.uuid4()],
        agent=Agent(id=uuid.uuid4()),
        generated_files=[],
    )
    content, is_error = await executor("delegate_to_x", {"brief": "do it"})
    assert is_error is True
    assert "depth" in content.lower()


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
