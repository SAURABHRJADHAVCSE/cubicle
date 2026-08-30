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
    parent_task_id: uuid.UUID | None = None
    depends_on: list[uuid.UUID] = []


class TaskConfigResponse(BaseModel):
    """Exposes the server's task-execution timeout so the UI can show a real
    ETA on an in-progress task ("times out at 10m") instead of a bare status
    label with no sense of whether it's still plausibly running."""

    task_timeout_seconds: int


class TaskUpdate(BaseModel):
    """Manual field override — e.g. dragging a Kanban card to a new column.
    Deliberately narrow: only status/priority for this pass, not
    title/brief/assigned_agents. Never triggers execution by itself —
    only /execute (or the webhook) actually dispatches to Celery."""

    status: str | None = None
    priority: int | None = None


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
    parent_task_id: uuid.UUID | None
    depends_on: list[uuid.UUID]

    result_structured: dict | None
    result_raw: str | None
    result_files: list[str] | None

    started_at: datetime | None
    completed_at: datetime | None
    tokens_used: int
    cost_usd: Decimal

    created_at: datetime
    updated_at: datetime
