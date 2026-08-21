"""Request/response schemas for the Agent CRUD API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AgentCreate(BaseModel):
    """Fields required to create a new agent."""

    name: str
    role: str

    engine_type: str
    engine_provider: str
    engine_model: str | None = None
    engine_command: str | None = None
    working_directory: str | None = None
    allowed_tools: list[str] | None = None

    personality_traits: list[str]
    personality_quirks: list[str] | None = None
    voice_language: str = "en"
    voice_gender: str = "female"
    voice_pace: str = "medium"

    character_id: str | None = None
    accent_color: str = "#6366f1"
    desk_position: int | None = None


class AgentUpdate(BaseModel):
    """Fields that may be patched on an existing agent. All optional."""

    name: str | None = None
    role: str | None = None

    engine_type: str | None = None
    engine_provider: str | None = None
    engine_model: str | None = None
    engine_command: str | None = None
    working_directory: str | None = None
    allowed_tools: list[str] | None = None

    personality_traits: list[str] | None = None
    personality_quirks: list[str] | None = None
    voice_language: str | None = None
    voice_gender: str | None = None
    voice_pace: str | None = None

    character_id: str | None = None
    accent_color: str | None = None
    desk_position: int | None = None

    status: str | None = None
    mood: str | None = None


class AgentRead(BaseModel):
    """Full agent representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    role: str

    engine_type: str
    engine_provider: str
    engine_model: str | None
    engine_command: str | None
    working_directory: str | None
    allowed_tools: list[str] | None

    personality_traits: list[str]
    personality_quirks: list[str] | None
    voice_language: str
    voice_gender: str
    voice_pace: str

    character_id: str | None
    accent_color: str
    desk_position: int | None

    status: str
    mood: str
    current_task_id: uuid.UUID | None

    created_at: datetime
    updated_at: datetime
