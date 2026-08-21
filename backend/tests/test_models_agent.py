"""Create/read round-trip tests for the Agent model, including its FK to Task."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Agent, Task


async def test_agent_round_trip_and_defaults(db_session: AsyncSession) -> None:
    task = Task(title="Screen resumes", brief="Find top 5 Python devs", assigned_agents=[])
    db_session.add(task)
    await db_session.flush()

    agent = Agent(
        name="Priya",
        role="Screener",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=["extrovert", "flirty"],
        current_task_id=task.id,
    )
    db_session.add(agent)
    await db_session.flush()
    await db_session.refresh(agent)

    fetched = (await db_session.execute(select(Agent).where(Agent.id == agent.id))).scalar_one()

    assert fetched.name == "Priya"
    assert fetched.status == "idle"
    assert fetched.mood == "neutral"
    assert fetched.accent_color == "#6366f1"
    assert fetched.voice_language == "en"
    assert fetched.current_task_id == task.id
