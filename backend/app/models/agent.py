"""Agent model — identity, engine configuration, personality, and live state."""

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Agent(Base):
    """An AI agent: identity, engine config, personality traits, and state.

    ``current_task_id`` is the only real foreign key between ``agents`` and
    ``tasks`` (``tasks.orchestrator_agent_id`` is intentionally unconstrained
    per the spec), so ``tasks`` is created before ``agents`` by SQLAlchemy's
    natural topological sort — no circular-FK workaround is needed. If a
    formal FK is ever added on ``orchestrator_agent_id``, use
    ``ForeignKey(..., use_alter=True)`` on it to break the resulting cycle.
    """

    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    # Originally a short label ("Researcher", "Dev") per the initial spec,
    # but AddAgentDialog's "Quick Role Templates" step composes a full
    # "<title>: <description>" sentence into this field — widened from the
    # original 50 chars to fit that (found via a real 500 on agent creation).
    role: Mapped[str] = mapped_column(String(500), nullable=False)

    engine_type: Mapped[str] = mapped_column(String(20), nullable=False)
    engine_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    engine_model: Mapped[str | None] = mapped_column(String(100))
    engine_command: Mapped[str | None] = mapped_column(String(500))
    working_directory: Mapped[str | None] = mapped_column(String(500))
    allowed_tools: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    personality_traits: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    personality_quirks: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    voice_language: Mapped[str] = mapped_column(String(10), server_default="en")
    voice_gender: Mapped[str] = mapped_column(String(10), server_default="female")
    voice_pace: Mapped[str] = mapped_column(String(10), server_default="medium")

    character_id: Mapped[str | None] = mapped_column(String(50))
    accent_color: Mapped[str] = mapped_column(String(7), server_default="#6366f1")
    desk_position: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(20), server_default="idle")
    mood: Mapped[str] = mapped_column(String(20), server_default="neutral")
    current_task_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id")
    )
    # When `status` last changed — set explicitly wherever status is
    # reassigned (task_worker.py). Deliberately NOT `updated_at` reused for
    # this: `updated_at` bumps on *any* column edit, which would make
    # "idle for >2 min" (the social scheduler's idle-detection signal)
    # unreliable if something unrelated touched the row mid-idle-streak.
    status_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Cooldown marker so the social scheduler doesn't re-fire a coffee/desk
    # -visit event on every single Beat tick while an agent stays idle.
    last_social_trigger_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
