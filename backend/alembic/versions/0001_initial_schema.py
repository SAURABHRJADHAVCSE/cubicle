"""initial schema: agents, tasks, settings

Revision ID: 0001
Revises:
Create Date: 2026-08-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # tasks is created first: agents.current_task_id is the only real FK
    # between the two tables, so tasks must exist before agents does.
    op.create_table(
        "tasks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("brief", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending"),
        sa.Column("priority", sa.Integer(), server_default="0"),
        sa.Column(
            "assigned_agents",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
        ),
        sa.Column("orchestrator_agent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("result_structured", postgresql.JSONB(), nullable=True),
        sa.Column("result_raw", sa.Text(), nullable=True),
        sa.Column("result_files", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tokens_used", sa.Integer(), server_default="0"),
        sa.Column("cost_usd", sa.Numeric(10, 6), server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "agents",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("engine_type", sa.String(length=20), nullable=False),
        sa.Column("engine_provider", sa.String(length=50), nullable=False),
        sa.Column("engine_model", sa.String(length=100), nullable=True),
        sa.Column("engine_command", sa.String(length=500), nullable=True),
        sa.Column("working_directory", sa.String(length=500), nullable=True),
        sa.Column("allowed_tools", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("personality_traits", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("personality_quirks", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("voice_language", sa.String(length=10), server_default="en"),
        sa.Column("voice_gender", sa.String(length=10), server_default="female"),
        sa.Column("voice_pace", sa.String(length=10), server_default="medium"),
        sa.Column("character_id", sa.String(length=50), nullable=True),
        sa.Column("accent_color", sa.String(length=7), server_default="#6366f1"),
        sa.Column("desk_position", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="idle"),
        sa.Column("mood", sa.String(length=20), server_default="neutral"),
        sa.Column("current_task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["current_task_id"],
            ["tasks.id"],
            name="fk_agents_current_task_id_tasks",
        ),
    )

    op.create_table(
        "settings",
        sa.Column("key", sa.String(length=100), primary_key=True),
        sa.Column("value_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("value_plain", sa.Text(), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("settings")
    op.drop_table("agents")
    op.drop_table("tasks")
