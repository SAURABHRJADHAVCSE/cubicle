"""Tests for app.utils.memory_search's pgvector nearest-neighbor query."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Agent, AgentMemory
from app.utils import memory_search as memory_search_module


def _vector(dim: int, value: float) -> list[float]:
    return [value] * dim


async def test_get_relevant_memories_orders_by_similarity(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    dim = get_settings().embedding_dimensions
    agent = Agent(
        name="Meera",
        role="QA",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=["perfectionist"],
    )
    db_session.add(agent)
    await db_session.flush()

    close = AgentMemory(agent_id=agent.id, content="close match", embedding=_vector(dim, 1.0))
    far = AgentMemory(agent_id=agent.id, content="far match", embedding=_vector(dim, -1.0))
    db_session.add_all([close, far])
    await db_session.flush()

    async def fake_aembed_text(text: str) -> list[float]:
        return _vector(dim, 0.9)

    monkeypatch.setattr(memory_search_module, "aembed_text", fake_aembed_text)

    results = await memory_search_module.get_relevant_memories(db_session, agent, "query", limit=2)

    assert results[0] == "close match"
    assert results[1] == "far match"


async def test_get_relevant_memories_returns_empty_on_embedding_failure(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = Agent(
        name="Sam",
        role="Writer",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=["playful"],
    )
    db_session.add(agent)
    await db_session.flush()

    async def failing_aembed_text(text: str) -> list[float]:
        raise RuntimeError("ollama unreachable")

    monkeypatch.setattr(memory_search_module, "aembed_text", failing_aembed_text)

    results = await memory_search_module.get_relevant_memories(db_session, agent, "query")

    assert results == []
