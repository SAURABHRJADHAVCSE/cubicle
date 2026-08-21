"""AgentMemory model — semantic memory entries with pgvector embeddings.

Note: cubicle_spec.md's DDL declares `embedding vector(1536)` (sized for
OpenAI's text-embedding-3-small). This project embeds via the user's local
Ollama `nomic-embed-text` model instead (see app.config.embedding_model),
which produces 768-dimensional vectors — so this column is `vector(768)`
to match what's actually written to it. See app.config.embedding_dimensions.
"""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.config import get_settings
from app.database import Base

_EMBEDDING_DIM = get_settings().embedding_dimensions


class AgentMemory(Base):
    """A piece of text an agent "remembers", with its embedding for semantic search."""

    __tablename__ = "agent_memory"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(_EMBEDDING_DIM), nullable=False)
    source_task_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id")
    )
    memory_type: Mapped[str] = mapped_column(String(20), server_default="task")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
