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

from app.api.deps import get_current_device
from app.database import engine, get_db
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
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """An async HTTP client bound to the ASGI app, sharing db_session's
    transaction so API-level writes roll back too (routes call `.commit()`,
    which — joined onto an external transaction via a SAVEPOINT — only
    releases the savepoint, it doesn't escape the outer rollback)."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    # Tests exercise application behavior, not the auth gate itself (that's
    # covered separately in test_api/test_auth.py) — treat every request as
    # already authenticated, same as overriding get_db above.
    async def _override_get_current_device() -> None:
        return None

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_device] = _override_get_current_device
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_device, None)
