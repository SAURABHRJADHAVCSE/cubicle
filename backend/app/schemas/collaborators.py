"""Request/response schemas for an agent's teammate roster (see
app/models/agent_collaborator.py, app/utils/agent_tools.py)."""

import uuid

from pydantic import BaseModel

from app.schemas.agent import AgentRead


class CollaboratorsUpdate(BaseModel):
    """Body for PUT /agents/{agent_id}/collaborators — replaces the full set."""

    collaborator_ids: list[uuid.UUID]


class CollaboratorsRead(BaseModel):
    """Response for GET/PUT /agents/{agent_id}/collaborators."""

    collaborators: list[AgentRead]
