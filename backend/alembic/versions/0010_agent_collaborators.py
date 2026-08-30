"""agent_collaborators — explicit "X may delegate to Y" edges

Composite primary key (agent_id, collaborator_agent_id) doubles as the
uniqueness constraint. CASCADE on both FKs: deleting either agent drops the
edge rather than leaving a dangling reference.

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_collaborators",
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("collaborator_agent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["collaborator_agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("agent_id", "collaborator_agent_id"),
    )
    op.create_index(
        "ix_agent_collaborators_agent_id", "agent_collaborators", ["agent_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_agent_collaborators_agent_id", table_name="agent_collaborators")
    op.drop_table("agent_collaborators")
