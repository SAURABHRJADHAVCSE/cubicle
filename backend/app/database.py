"""Async SQLAlchemy engine, session factory, and declarative base."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=(settings.env == "development"),
)

async_session_factory = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)

# A separate, unpooled engine for Celery task bodies. Each Celery task runs
# under its own `asyncio.run(...)` call (a fresh event loop every time),
# but a *pooled* asyncpg connection is tied to whichever loop created it —
# reusing `engine`'s pool here would work for a worker process's first task
# and then fail every task after with "attached to a different loop".
# NullPool opens a fresh connection per checkout and never caches one
# across calls, so there's nothing to go stale.
worker_engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
    echo=(settings.env == "development"),
)

worker_session_factory = async_sessionmaker(
    worker_engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    """Declarative base class for all Cubicle SQLAlchemy models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a request-scoped async DB session."""
    async with async_session_factory() as session:
        yield session
