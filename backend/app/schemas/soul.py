"""Request/response schemas for an agent's SOUL.md."""

from pydantic import BaseModel


class SoulUpdate(BaseModel):
    """Body for PUT /agents/{agent_id}/soul."""

    content: str


class SoulRead(BaseModel):
    """Response for PUT /agents/{agent_id}/soul. Reading SOUL.md itself
    goes through the existing generic GET /agents/{id}/files/content?path=
    SOUL.md — it's just a normal file at the workspace root, no dedicated
    read schema/route needed."""

    content: str
