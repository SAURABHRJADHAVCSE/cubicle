"""agents.is_media_specialist — explicit opt-in for generate_image/generate_video

Media generation tools used to be granted to any agent that happened to
resolve a usable Gemini key (its own, or the global fallback) via
media/registry.py — with no regard for role. That silently gave a personal
assistant agent (any Gemini-keyed agent, really) its own generate_image tool
just because it shared a provider with the actual specialist, so it would
call that directly instead of ever delegating to the specialist — confirmed
live. This makes media-tool eligibility an explicit, user-set flag instead
of an implicit side effect of key sharing.

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column(
            "is_media_specialist", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("agents", "is_media_specialist")
