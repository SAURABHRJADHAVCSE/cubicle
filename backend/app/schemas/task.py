"""Request/response schemas for the Task CRUD API."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    """Fields required to create a new task."""

    title: str
    brief: str
    priority: int = 0
    assigned_agents: list[uuid.UUID]
    orchestrator_agent_id: uuid.UUID | None = None


class TaskRead(BaseModel):
    """Full task representation returned by the API, including results."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    brief: str
    status: str
    priority: int

    assigned_agents: list[uuid.UUID]
    orchestrator_agent_id: uuid.UUID | None

    result_structured: dict | None
    result_raw: str | None
    result_files: list[str] | None

    started_at: datetime | None
    completed_at: datetime | None
    tokens_used: int
    cost_usd: Decimal

    created_at: datetime
    updated_at: datetime
