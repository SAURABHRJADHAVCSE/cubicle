"""Tests for the async memory-storage logic behind the Celery task."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Agent, AgentMemory
from app.workers import memory_worker as memory_worker_module
from tests.test_workers.test_task_worker import _NoCloseSessionCM


async def test_store_memory_async_persists_embedding(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = Agent(
        name="Ravi",
        role="Dev",
        engine_type="cli",
        engine_provider="claude_code",
        personality_traits=["workaholic"],
    )
    db_session.add(agent)
    await db_session.flush()

    dim = get_settings().embedding_dimensions
    monkeypatch.setattr(memory_worker_module, "embed_text", lambda content: [0.2] * dim)
    monkeypatch.setattr(
        memory_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session)
    )

    await memory_worker_module._store_memory_async(agent.id, "did a thing", None, "task")

    fetched = (
        await db_session.execute(select(AgentMemory).where(AgentMemory.agent_id == agent.id))
    ).scalar_one()
    assert fetched.content == "did a thing"
    assert fetched.memory_type == "task"


async def test_store_memory_async_swallows_embedding_failure(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> None:
    agent = Agent(
        name="Ravi2",
        role="Dev",
        engine_type="cli",
        engine_provider="claude_code",
        personality_traits=["workaholic"],
    )
    db_session.add(agent)
    await db_session.flush()

    def failing_embed(content: str):
        raise RuntimeError("ollama down")

    monkeypatch.setattr(memory_worker_module, "embed_text", failing_embed)
    monkeypatch.setattr(
        memory_worker_module, "worker_session_factory", lambda: _NoCloseSessionCM(db_session)
    )

    await memory_worker_module._store_memory_async(agent.id, "won't be saved", None, "task")

    count = (
        await db_session.execute(select(AgentMemory).where(AgentMemory.agent_id == agent.id))
    ).scalars().all()
    assert count == []
