"""tasks.parent_task_id — links a boss-routed child task back to its parent

route_task() creates child Task rows for each subtask but never recorded a
link back to the parent beyond the parent's own result_structured.
child_task_ids (one-way, JSONB). This adds a real column so a child's
completion can look up and update its parent directly.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("parent_task_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tasks_parent_task_id_tasks",
        "tasks",
        "tasks",
        ["parent_task_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_parent_task_id_tasks", "tasks", type_="foreignkey")
    op.drop_column("tasks", "parent_task_id")
