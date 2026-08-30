"""Tests for POST /webhooks/tasks — the shared-secret auth path for
external callers (no paired device). Celery dispatch is mocked out, same
as test_tasks.py."""

from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from app.config import get_settings
from app.main import app
from app.workers import task_worker as task_worker_module


@pytest.fixture(autouse=True)
def _reset_settings_override():
    yield
    app.dependency_overrides.pop(get_settings, None)


def _configure_webhook_secret(secret: str | None) -> None:
    fake_settings = SimpleNamespace(webhook_secret=secret)
    app.dependency_overrides[get_settings] = lambda: fake_settings


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


async def test_webhook_404s_when_secret_unconfigured(client: AsyncClient) -> None:
    _configure_webhook_secret(None)

    resp = await client.post(
        "/webhooks/tasks",
        json={"title": "t", "brief": "do it", "assigned_agents": []},
        headers={"X-Webhook-Secret": "anything"},
    )
    assert resp.status_code == 404


async def test_webhook_401s_on_missing_header(client: AsyncClient) -> None:
    _configure_webhook_secret("correct-secret")

    resp = await client.post(
        "/webhooks/tasks", json={"title": "t", "brief": "do it", "assigned_agents": []}
    )
    assert resp.status_code == 401


async def test_webhook_401s_on_wrong_secret(client: AsyncClient) -> None:
    _configure_webhook_secret("correct-secret")

    resp = await client.post(
        "/webhooks/tasks",
        json={"title": "t", "brief": "do it", "assigned_agents": []},
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert resp.status_code == 401


async def test_webhook_creates_and_dispatches_task_with_correct_secret(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _configure_webhook_secret("correct-secret")
    dispatched: list[str] = []
    monkeypatch.setattr(task_worker_module.execute_task, "delay", lambda task_id: dispatched.append(task_id))

    agent_id = await _create_agent(client)
    resp = await client.post(
        "/webhooks/tasks",
        json={"title": "From CI", "brief": "Run the thing", "assigned_agents": [agent_id]},
        headers={"X-Webhook-Secret": "correct-secret"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "assigned"
    assert dispatched == [body["id"]]


async def test_webhook_routes_when_orchestrator_set(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _configure_webhook_secret("correct-secret")
    routed: list[str] = []
    monkeypatch.setattr(task_worker_module.route_task, "delay", lambda task_id: routed.append(task_id))

    agent_id = await _create_agent(client)
    resp = await client.post(
        "/webhooks/tasks",
        json={
            "title": "From CI", "brief": "Run the thing",
            "assigned_agents": [agent_id], "orchestrator_agent_id": agent_id,
        },
        headers={"X-Webhook-Secret": "correct-secret"},
    )

    assert resp.status_code == 200
    assert routed == [resp.json()["id"]]
