"""conversations and agent_memory (pgvector)

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Must match app.config.Settings.embedding_dimensions (768 for the
# nomic-embed-text model this project embeds with via local Ollama — not
# the 1536 in cubicle_spec.md's DDL, which assumed OpenAI embeddings).
EMBEDDING_DIM = 768


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "conversations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_type", sa.String(length=20), server_default="chat"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["agent_id"], ["agents.id"], name="fk_conversations_agent_id_agents"
        ),
    )
    op.create_index(
        "ix_conversations_agent_id_created_at",
        "conversations",
        ["agent_id", "created_at"],
    )

    op.create_table(
        "agent_memory",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("source_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("memory_type", sa.String(length=20), server_default="task"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["agent_id"], ["agents.id"], name="fk_agent_memory_agent_id_agents"
        ),
        sa.ForeignKeyConstraint(
            ["source_task_id"],
            ["tasks.id"],
            name="fk_agent_memory_source_task_id_tasks",
        ),
    )
    op.execute(
        "CREATE INDEX ix_agent_memory_embedding ON agent_memory "
        "USING ivfflat (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.drop_table("agent_memory")
    op.drop_index("ix_conversations_agent_id_created_at", table_name="conversations")
    op.drop_table("conversations")
    op.execute("DROP EXTENSION IF EXISTS vector")
