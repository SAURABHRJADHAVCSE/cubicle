"""widen agents.role to fit the Quick Role Template descriptions

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("agents", "role", type_=sa.String(length=500), existing_nullable=False)


def downgrade() -> None:
    op.alter_column("agents", "role", type_=sa.String(length=50), existing_nullable=False)
