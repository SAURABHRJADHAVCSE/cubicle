"""agents.tavily_api_key_encrypted — per-agent Tavily key override

Same "agent's own key first, global fallback" pattern media/registry.py's
_resolve_gemini_key already established for Gemini, applied to Tavily via a
dedicated column rather than reusing engine_api_key_encrypted — Tavily is
never a chat engine_provider, so it needs its own credential slot.

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("tavily_api_key_encrypted", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "tavily_api_key_encrypted")
