"""Tests for the agent chat API. The engine and Socket.io emit are mocked
out so these stay fast and don't require model credentials or a connected
Socket.io client.
"""

import pytest
from httpx import AsyncClient

from app.api import chat as chat_module


class _StubStreamEngine:
    async def chat_stream(self, message, history):
        for chunk in ["Hel", "lo!"]:
            yield chunk


async def _create_agent(client: AsyncClient) -> str:
    resp = await client.post(
        "/agents",
        json={
            "name": "Priya",
            "role": "Screener",
            "engine_type": "api",
            "engine_provider": "anthropic",
            "personality_traits": ["extrovert"],
        },
    )
    return resp.json()["id"]


@pytest.fixture(autouse=True)
def _mock_engine_and_socket(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat_module, "get_engine", lambda agent: _StubStreamEngine())

    emitted = []

    async def fake_emit(event, data):
        emitted.append((event, data))

    monkeypatch.setattr(chat_module.sio, "emit", fake_emit)
    monkeypatch.setattr(chat_module, "get_relevant_memories", lambda *a, **kw: _empty())
    monkeypatch.setattr(chat_module.store_memory, "delay", lambda *a, **kw: None)
    return emitted


async def _empty():
    return []


async def test_send_chat_message_persists_and_returns_reply(client: AsyncClient) -> None:
    agent_id = await _create_agent(client)

    resp = await client.post(f"/agents/{agent_id}/chat", json={"message": "hi there"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "agent"
    assert body["content"] == "Hello!"


async def test_list_conversations_includes_both_turns(client: AsyncClient) -> None:
    agent_id = await _create_agent(client)
    await client.post(f"/agents/{agent_id}/chat", json={"message": "hi there"})

    resp = await client.get(f"/agents/{agent_id}/conversations")

    assert resp.status_code == 200
    roles = [m["role"] for m in resp.json()]
    assert roles == ["user", "agent"]


async def test_chat_nonexistent_agent_404(client: AsyncClient) -> None:
    import uuid

    resp = await client.post(f"/agents/{uuid.uuid4()}/chat", json={"message": "hi"})
    assert resp.status_code == 404
