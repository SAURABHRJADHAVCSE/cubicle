"""Tests for the Task CRUD + execute API. Celery dispatch is mocked out so
these stay fast and don't require a live worker or model credentials.
"""

import pytest
from httpx import AsyncClient

from app.api import tasks as tasks_module


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
    monkeypatch.setattr(tasks_module.execute_task, "delay", lambda task_id: dispatched.append(task_id))

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
    monkeypatch.setattr(tasks_module.execute_task, "delay", lambda task_id: None)

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
    import uuid

    resp = await client.post(f"/tasks/{uuid.uuid4()}/execute")
    assert resp.status_code == 404
