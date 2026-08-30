"""Tests for the Task CRUD + execute API. Celery dispatch is mocked out so
these stay fast and don't require a live worker or model credentials.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.workers import task_worker as task_worker_module


async def _create_agent(client: AsyncClient) -> str:
    resp = await client.post(
        "/agents",
        json={
            "name": "Ravi",
            "role": "Dev",
            "engine_type": "cli",
            "engine_provider": "claude_code",
            "personality_traits": ["workaholic"],
        },
    )
    return resp.json()["id"]


async def test_task_config_exposes_timeout(client: AsyncClient) -> None:
    resp = await client.get("/tasks/config")
    assert resp.status_code == 200
    assert resp.json()["task_timeout_seconds"] == 600


async def test_create_task_starts_pending(client: AsyncClient) -> None:
    agent_id = await _create_agent(client)

    resp = await client.post(
        "/tasks",
        json={"title": "Screen resumes", "brief": "Find top 5", "assigned_agents": [agent_id]},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["assigned_agents"] == [agent_id]


async def test_execute_task_dispatches_and_get_returns_it(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    dispatched: list[str] = []
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda task_id: dispatched.append(task_id))

    agent_id = await _create_agent(client)
    created = (
        await client.post(
            "/tasks",
            json={"title": "t", "brief": "do it", "assigned_agents": [agent_id]},
        )
    ).json()

    exec_resp = await client.post(f"/tasks/{created['id']}/execute")
    assert exec_resp.status_code == 200
    assert exec_resp.json()["status"] == "assigned"
    assert dispatched == [created["id"]]

    get_resp = await client.get(f"/tasks/{created['id']}")
    assert get_resp.json()["status"] == "assigned"


async def test_execute_already_executed_task_conflicts(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda task_id: None)

    agent_id = await _create_agent(client)
    created = (
        await client.post(
            "/tasks",
            json={"title": "t", "brief": "do it", "assigned_agents": [agent_id]},
        )
    ).json()

    await client.post(f"/tasks/{created['id']}/execute")
    second = await client.post(f"/tasks/{created['id']}/execute")
    assert second.status_code == 409


async def test_execute_nonexistent_task_404(client: AsyncClient) -> None:
    resp = await client.post(f"/tasks/{uuid.uuid4()}/execute")
    assert resp.status_code == 404


async def test_execute_task_with_orchestrator_routes_instead_of_executing(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Regression check for dispatch_task's branch, post-refactor (see
    # task_worker.dispatch_task, shared by this route and /webhooks/tasks).
    routed: list[str] = []
    monkeypatch.setattr(task_worker_module.route_task, "delay", lambda task_id: routed.append(task_id))
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda task_id: None)

    agent_id = await _create_agent(client)
    created = (
        await client.post(
            "/tasks",
            json={
                "title": "t", "brief": "do it",
                "assigned_agents": [agent_id], "orchestrator_agent_id": agent_id,
            },
        )
    ).json()

    exec_resp = await client.post(f"/tasks/{created['id']}/execute")
    assert exec_resp.status_code == 200
    assert routed == [created["id"]]


async def test_patch_updates_status_and_priority(client: AsyncClient) -> None:
    agent_id = await _create_agent(client)
    created = (
        await client.post(
            "/tasks",
            json={"title": "t", "brief": "do it", "assigned_agents": [agent_id]},
        )
    ).json()

    resp = await client.patch(f"/tasks/{created['id']}", json={"status": "in_progress", "priority": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "in_progress"
    assert body["priority"] == 5

    get_resp = await client.get(f"/tasks/{created['id']}")
    assert get_resp.json()["status"] == "in_progress"


async def test_patch_does_not_dispatch(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    dispatched: list[str] = []
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda task_id: dispatched.append(task_id))

    agent_id = await _create_agent(client)
    created = (
        await client.post(
            "/tasks",
            json={"title": "t", "brief": "do it", "assigned_agents": [agent_id]},
        )
    ).json()

    await client.patch(f"/tasks/{created['id']}", json={"status": "completed"})
    assert dispatched == []


async def test_execute_blocks_task_with_incomplete_dependency(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    dispatched: list[str] = []
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda task_id: dispatched.append(task_id))

    agent_id = await _create_agent(client)
    dependency = (
        await client.post(
            "/tasks",
            json={"title": "dep", "brief": "do first", "assigned_agents": [agent_id]},
        )
    ).json()
    dependent = (
        await client.post(
            "/tasks",
            json={
                "title": "t", "brief": "do second", "assigned_agents": [agent_id],
                "depends_on": [dependency["id"]],
            },
        )
    ).json()

    resp = await client.post(f"/tasks/{dependent['id']}/execute")
    assert resp.status_code == 200
    assert resp.json()["status"] == "blocked"
    assert dispatched == []


async def test_blocked_task_auto_promotes_once_dependency_completes(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    from app.workers import task_worker as tw

    dispatched: list[str] = []
    monkeypatch.setattr(tw.execute_task, "delay", lambda task_id: dispatched.append(task_id))
    monkeypatch.setattr(tw, "emit_celebration", lambda *_: None)
    monkeypatch.setattr(tw, "generate_and_emit_dialogue", _RecordingDelayStub())
    monkeypatch.setattr(tw, "store_memory", _RecordingDelayStub())
    monkeypatch.setattr(tw, "get_engine", lambda a: _StubEngineStub())

    agent_id = await _create_agent(client)
    dependency = (
        await client.post(
            "/tasks", json={"title": "dep", "brief": "do first", "assigned_agents": [agent_id]}
        )
    ).json()
    dependent = (
        await client.post(
            "/tasks",
            json={
                "title": "t", "brief": "do second", "assigned_agents": [agent_id],
                "depends_on": [dependency["id"]],
            },
        )
    ).json()
    await client.post(f"/tasks/{dependent['id']}/execute")  # -> blocked
    dispatched.clear()

    # Drive the dependency through the real worker path — its completion is
    # what's supposed to auto-promote the blocked task.
    class _NoCloseCM:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(tw, "worker_session_factory", lambda: _NoCloseCM())
    await tw._execute_task_async(uuid.UUID(dependency["id"]))

    dependent_after = await client.get(f"/tasks/{dependent['id']}")
    assert dependent_after.json()["status"] == "assigned"
    assert dispatched == [dependent["id"]]


class _RecordingDelayStub:
    def delay(self, *args: object) -> None:
        pass


class _StubEngineStub:
    async def execute(self, prompt: str, context: dict):
        from app.engines.base import EngineResult

        return EngineResult(output="ok", tokens_used=1, cost_usd=0.0)
