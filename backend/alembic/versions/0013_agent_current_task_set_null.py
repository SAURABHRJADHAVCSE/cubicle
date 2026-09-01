"""agents.current_task_id -> ON DELETE SET NULL

Same reasoning as 0012 for agent_memory.source_task_id: without this, deleting
a task an agent's current_task_id still points at would block outright with a
ForeignKeyViolationError instead of just clearing the reference. In practice
_run_task_execution/_mark_failed already null this out before a task reaches
a deletable status, but there's no reason a stray reference should ever be
able to block a delete.

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-01

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("fk_agents_current_task_id_tasks", "agents", type_="foreignkey")
    op.create_foreign_key(
        "fk_agents_current_task_id_tasks",
        "agents",
        "tasks",
        ["current_task_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_agents_current_task_id_tasks", "agents", type_="foreignkey")
    op.create_foreign_key(
        "fk_agents_current_task_id_tasks",
        "agents",
        "tasks",
        ["current_task_id"],
        ["id"],
    )
