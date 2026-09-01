"""Tests for the agent chat API. The engine and Socket.io emit are mocked
out so these stay fast and don't require model credentials or a connected
Socket.io client.
"""

import pytest
from httpx import AsyncClient

from app.api import chat as chat_module


class _StubStreamEngine:
    async def chat_stream(self, message, history, tools=None, tool_executor=None, system_prompt=None):
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


class _NoCloseSessionCM:
    """Wraps `db_session` so `async with async_session_factory() as s` in
    chat.py's delegation path (see task_worker.py's identical fixture and
    docstring) reuses the test's own transactional session instead of
    opening a real connection that can't see this test's uncommitted rows.
    """

    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc_info):
        return False


class _DelegatingEngine:
    """Simulates an orchestrator LLM turn that calls exactly one tool —
    picking whichever tool's description names `target_name`, mirroring how
    a real model reads each delegate tool's description (name + role) to
    pick the actual domain-fit teammate rather than just the first one
    listed (delegation is no longer scoped to a single curated
    collaborator, so the tools list may contain other agents too — see
    build_tools_for_agent's get_delegation_candidates)."""

    def __init__(self, target_name: str):
        self.target_name = target_name

    async def chat_stream(self, message, history, tools=None, tool_executor=None, system_prompt=None):
        if tools and tool_executor is not None:
            match = next(t for t in tools if self.target_name in t["function"]["description"])
            content, _is_error = await tool_executor(match["function"]["name"], {"brief": "draw a cat"})
            yield f"Done: {content}"
        else:
            yield "no tools available"


class _TeammateEngine:
    async def execute(self, prompt, context):
        from app.engines.base import EngineResult

        return EngineResult(output="a cute cat drawing", tokens_used=1, cost_usd=0.0)


async def test_chat_delegates_to_teammate_and_emits_websocket_events(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, db_session
) -> None:
    from app.workers import task_worker as task_worker_module

    main_id = await _create_agent(client)
    teammate_resp = await client.post(
        "/agents",
        json={
            "name": "Artist", "role": "Image Gen", "engine_type": "cli",
            "engine_provider": "claude_code", "personality_traits": [],
        },
    )
    teammate_id = teammate_resp.json()["id"]
    await client.put(
        f"/agents/{main_id}/collaborators", json={"collaborator_ids": [teammate_id]}
    )

    def fake_get_engine(agent):
        return _DelegatingEngine("Artist") if str(agent.id) == main_id else _TeammateEngine()

    monkeypatch.setattr(chat_module, "get_engine", fake_get_engine)
    monkeypatch.setattr(
        chat_module, "async_session_factory", lambda: _NoCloseSessionCM(db_session)
    )
    monkeypatch.setattr(task_worker_module, "get_engine", fake_get_engine)
    monkeypatch.setattr(task_worker_module, "emit_celebration", lambda *_: None)
    monkeypatch.setattr(task_worker_module.generate_and_emit_dialogue, "delay", lambda *a, **kw: None)
    monkeypatch.setattr(task_worker_module.store_memory, "delay", lambda *a, **kw: None)

    emitted = []

    async def fake_emit(event, data):
        emitted.append((event, data))

    monkeypatch.setattr(chat_module.sio, "emit", fake_emit)

    resp = await client.post(f"/agents/{main_id}/chat", json={"message": "make me an insta post"})

    assert resp.status_code == 200
    assert "a cute cat drawing" in resp.json()["content"]

    started = [e for e in emitted if e[0] == "chat_tool_call_started"]
    finished = [e for e in emitted if e[0] == "chat_tool_call_finished"]
    assert len(started) == 1
    assert started[0][1]["target_agent_name"] == "Artist"
    assert started[0][1]["agent_id"] == main_id
    assert len(finished) == 1
    assert finished[0][1]["status"] == "completed"
