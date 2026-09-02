"""agents.has_web_search — explicit opt-in for web_search/web_crawl

Same capability-gating pattern as 0014_agent_is_media_specialist: a
configured Tavily key alone must not be sufficient to grant every agent
web search — without this flag, adding one global Tavily key would
silently give every agent on the roster the tool, the same class of bug
0014 was built to close for media generation.

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("has_web_search", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("agents", "has_web_search")
