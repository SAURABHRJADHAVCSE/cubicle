"""tasks.depends_on — dependencies a task must wait on before dispatching

No per-element FK: same precedent already documented on assigned_agents in
the Task model (a Postgres array column can't carry a foreign-key
constraint on its individual elements).

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "depends_on",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    op.drop_column("tasks", "depends_on")
