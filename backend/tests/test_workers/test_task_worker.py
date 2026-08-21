"""Tests for the async task-execution logic behind the Celery task.

These call `_execute_task_async` directly (never through Celery's broker),
with `get_engine` monkeypatched to a stub engine, so they're fast and don't
require a running worker or real model credentials.
"""

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
    monkeypatch.setattr(task_worker_module, "async_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._execute_task_async(task.id)

    await db_session.refresh(task)
    await db_session.refresh(agent)
    assert task.status == "completed"
    assert task.result_raw == "all done"
    assert task.tokens_used == 10
    assert agent.status == "idle"
    assert agent.current_task_id is None


async def test_execute_task_engine_failure_marks_task_failed(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent, task = await _make_agent_and_task(db_session)

    stub = _StubEngine(error=RuntimeError("boom"))
    monkeypatch.setattr(task_worker_module, "get_engine", lambda a: stub)
    monkeypatch.setattr(task_worker_module, "async_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._execute_task_async(task.id)

    await db_session.refresh(task)
    await db_session.refresh(agent)
    assert task.status == "failed"
    assert "boom" in task.result_raw
    assert agent.status == "idle"


async def test_execute_task_missing_task_is_noop(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    import uuid

    monkeypatch.setattr(task_worker_module, "async_session_factory", lambda: _NoCloseSessionCM(db_session))

    await task_worker_module._execute_task_async(uuid.uuid4())  # should not raise
