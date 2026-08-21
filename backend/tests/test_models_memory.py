"""Create/read round-trip tests for the AgentMemory model (pgvector)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Agent, AgentMemory


async def test_agent_memory_round_trip(db_session: AsyncSession) -> None:
    agent = Agent(
        name="Arjun",
        role="Researcher",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=["introvert"],
    )
    db_session.add(agent)
    await db_session.flush()

    dim = get_settings().embedding_dimensions
    memory = AgentMemory(agent_id=agent.id, content="Finished the Q3 report", embedding=[0.1] * dim)
    db_session.add(memory)
    await db_session.flush()
    await db_session.refresh(memory)

    fetched = (
        await db_session.execute(select(AgentMemory).where(AgentMemory.id == memory.id))
    ).scalar_one()

    assert fetched.content == "Finished the Q3 report"
    assert fetched.memory_type == "task"
    assert len(fetched.embedding) == dim
