"""AgentCollaborator — an explicit, user-curated "X can delegate to Y" edge.

Deliberately not auto-derived from the full agent roster (unlike
_route_task_async's current `select(Agent)` over everyone) — the user
assigns teammates by hand, mirroring how they'd actually build a team.
"""

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AgentCollaborator(Base):
    """A directed edge: ``agent_id`` may delegate to ``collaborator_agent_id``.

    Composite primary key doubles as the uniqueness constraint — no
    duplicate edges, no surrogate id needed. CASCADE on both sides: deleting
    either agent should silently drop the edge rather than leave a dangling
    reference (there's no soft-delete for agents).
    """

    __tablename__ = "agent_collaborators"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True
    )
    collaborator_agent_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True
    )
