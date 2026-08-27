"""ON DELETE CASCADE on conversations/agent_memory -> agents

Deleting an agent that had any chat history or stored memories failed
with an unhandled ForeignKeyViolationError — there's no product reason to
keep orphaned conversations/memories around for an agent that's gone.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-27

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("fk_conversations_agent_id_agents", "conversations", type_="foreignkey")
    op.create_foreign_key(
        "fk_conversations_agent_id_agents",
        "conversations",
        "agents",
        ["agent_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("fk_agent_memory_agent_id_agents", "agent_memory", type_="foreignkey")
    op.create_foreign_key(
        "fk_agent_memory_agent_id_agents",
        "agent_memory",
        "agents",
        ["agent_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_conversations_agent_id_agents", "conversations", type_="foreignkey")
    op.create_foreign_key(
        "fk_conversations_agent_id_agents", "conversations", "agents", ["agent_id"], ["id"]
    )
    op.drop_constraint("fk_agent_memory_agent_id_agents", "agent_memory", type_="foreignkey")
    op.create_foreign_key(
        "fk_agent_memory_agent_id_agents", "agent_memory", "agents", ["agent_id"], ["id"]
    )
