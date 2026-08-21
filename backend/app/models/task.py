"""Task model — a unit of work assigned to one or more agents."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ARRAY, DateTime, Integer, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Task(Base):
    """A task submitted by the user and worked on by one or more agents."""

    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    brief: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="pending")
    priority: Mapped[int] = mapped_column(Integer, server_default="0")

    assigned_agents: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), nullable=False
    )
    # No formal FK: matches the spec's DDL exactly, and an array column can't
    # carry a Postgres foreign-key constraint on its elements anyway.
    orchestrator_agent_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))

    result_structured: Mapped[dict | None] = mapped_column(JSONB)
    result_raw: Mapped[str | None] = mapped_column(Text)
    result_files: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tokens_used: Mapped[int] = mapped_column(Integer, server_default="0")
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6), server_default="0")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
