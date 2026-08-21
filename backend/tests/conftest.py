"""Shared pytest fixtures.

Tests run against the app's already-migrated Postgres database (the
container's ``CMD`` runs ``alembic upgrade head`` before uvicorn/pytest
starts). Each test gets an isolated session wrapped in an outer transaction
plus a SAVEPOINT, rolled back at teardown, so tests never leave residue.
Postgres-only types (UUID, ARRAY, JSONB) rule out SQLite for this suite.
"""

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import engine
from app.main import app


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """A transactional AsyncSession that rolls back after each test."""
    async with engine.connect() as connection:
        await connection.begin()
        session = AsyncSession(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        try:
            yield session
        finally:
            await session.close()
            await connection.rollback()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """An async HTTP client bound directly to the FastAPI ASGI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
