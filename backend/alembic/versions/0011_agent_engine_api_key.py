"""agents.engine_api_key_encrypted — bring-your-own API provider key

Encrypted at rest via app/utils/encryption.py (Fernet, keyed off SECRET_KEY),
same mechanism already used for the Claude Code OAuth token.

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agents", sa.Column("engine_api_key_encrypted", sa.LargeBinary(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("agents", "engine_api_key_encrypted")
