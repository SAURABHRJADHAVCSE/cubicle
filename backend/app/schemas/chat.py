"""Request/response schemas for the agent chat API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatRequest(BaseModel):
    """Body for POST /agents/{agent_id}/chat."""

    message: str


class ConversationRead(BaseModel):
    """A single persisted chat message."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    role: str
    content: str
    message_type: str
    created_at: datetime
