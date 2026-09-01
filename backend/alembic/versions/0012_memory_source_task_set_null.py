"""agent_memory.source_task_id -> ON DELETE SET NULL

Without this, deleting a task blocks outright with a ForeignKeyViolationError
the moment any memory references it as its source — confirmed live: every
completed task that ran store_memory (i.e. almost every completed task) could
never be deleted through the task-delete feature. A memory is still
meaningful content once its originating task is gone; it should just lose
the reference, not block the delete.

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-01

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "fk_agent_memory_source_task_id_tasks", "agent_memory", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_agent_memory_source_task_id_tasks",
        "agent_memory",
        "tasks",
        ["source_task_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_agent_memory_source_task_id_tasks", "agent_memory", type_="foreignkey"
    )
    op.create_foreign_key(
        "fk_agent_memory_source_task_id_tasks",
        "agent_memory",
        "tasks",
        ["source_task_id"],
        ["id"],
    )
