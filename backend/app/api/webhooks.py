"""Webhook routes for external systems (CI, scripts, a future Slack
integration) — no paired device, authenticated via a shared secret instead
of the device-token bearer auth every other router uses. See
app.api.deps.verify_webhook_secret."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_webhook_secret
from app.api.tasks import _create_and_dispatch
from app.database import get_db
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskRead

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post(
    "/tasks", response_model=TaskRead, dependencies=[Depends(verify_webhook_secret)]
)
async def create_and_dispatch_task(
    payload: TaskCreate, db: AsyncSession = Depends(get_db)
) -> Task:
    """Create a task and dispatch it immediately — the webhook equivalent
    of POST /tasks followed by POST /tasks/{id}/execute."""
    return await _create_and_dispatch(payload, db)
