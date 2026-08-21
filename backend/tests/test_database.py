"""Tests for app.database session/engine wiring."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import engine


async def test_db_session_can_query(db_session: AsyncSession) -> None:
    result = await db_session.execute(select(1))
    assert result.scalar_one() == 1


def test_engine_has_pool_pre_ping() -> None:
    assert engine.pool._pre_ping is True
