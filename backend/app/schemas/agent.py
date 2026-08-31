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
    # Plaintext in the request only — encrypted before storage (see
    # api/agents.py's create_agent) and never returned; AgentRead exposes
    # only has_engine_api_key. Required for a bring-your-own API provider
    # (engine_provider outside {"ollama", "anthropic"}), validated in the route.
    engine_api_key: str | None = None

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
    # Same plaintext-in/encrypted-at-rest contract as AgentCreate. Sent as
    # "" to explicitly clear a stored key; omitted entirely (the default,
    # via exclude_unset) to leave whatever's already stored untouched.
    engine_api_key: str | None = None

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
    # Never the raw key — just whether one is configured (see
    # Agent.has_engine_api_key in models/agent.py).
    has_engine_api_key: bool
    # Whether this agent is anyone's teammate (agent_collaborators) — not a
    # real column, set as a transient attribute by api/agents.py's
    # _mark_sub_agents() before serialization. Drives the frontend's "only
    # chat with main agents" rule. Defaults False defensively (rather than
    # a required field) so a route that forgets to call _mark_sub_agents
    # degrades to "looks like a main agent" instead of a 500.
    is_sub_agent: bool = False

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
