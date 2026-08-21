"""Create/read round-trip tests for the Task model."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task


async def test_task_round_trip_and_defaults(db_session: AsyncSession) -> None:
    task = Task(title="Screen resumes", brief="Find top 5 Python devs", assigned_agents=[])
    db_session.add(task)
    await db_session.flush()
    await db_session.refresh(task)

    fetched = (await db_session.execute(select(Task).where(Task.id == task.id))).scalar_one()

    assert fetched.title == "Screen resumes"
    assert fetched.status == "pending"
    assert fetched.priority == 0
    assert fetched.tokens_used == 0
    assert fetched.cost_usd == Decimal("0")
    assert fetched.assigned_agents == []
    assert fetched.created_at is not None
    assert fetched.updated_at is not None
