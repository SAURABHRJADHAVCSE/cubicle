"""Task CRUD + execution API routes."""

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.workers.task_worker import dependencies_satisfied, dispatch_task
from app.ws.events import emit_task_status

logger = structlog.get_logger()

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _get_task_or_404(task_id: uuid.UUID, db: AsyncSession) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, db: AsyncSession = Depends(get_db)) -> Task:
    """Create a new task in `pending` status. Call /execute to dispatch it."""
    task = Task(**payload.model_dump(), status="pending")
    db.add(task)
    await db.commit()
    await db.refresh(task)
    logger.info("task_created", task_id=str(task.id), title=task.title)
    return task


@router.get("", response_model=list[TaskRead])
async def list_tasks(db: AsyncSession = Depends(get_db)) -> list[Task]:
    """List all tasks."""
    result = await db.execute(select(Task).order_by(Task.created_at))
    return list(result.scalars().all())


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Task:
    """Fetch a single task by id, including its result once available."""
    return await _get_task_or_404(task_id, db)


@router.post("/{task_id}/execute", response_model=TaskRead)
async def execute_task_route(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Task:
    """Dispatch a pending task to a Celery worker for execution — or, if it
    depends on a task that hasn't completed yet, mark it "blocked" instead.
    A blocked task auto-dispatches later on its own (see
    task_worker._promote_blocked_dependents), once every dependency clears."""
    task = await _get_task_or_404(task_id, db)
    if task.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Task is '{task.status}', not 'pending' — cannot execute again",
        )

    await _dispatch_or_block(db, task)
    await db.refresh(task)
    return task


async def _dispatch_or_block(db: AsyncSession, task: Task) -> None:
    if task.depends_on and not await dependencies_satisfied(db, task):
        task.status = "blocked"
        await db.commit()
        return
    await dispatch_task(db, task)


async def _create_and_dispatch(payload: TaskCreate, db: AsyncSession) -> Task:
    """Create a task and immediately dispatch it (or block it, see
    _dispatch_or_block), in one call — the path POST /webhooks/tasks uses
    (an external caller has no reason to create a task and then make a
    second request to run it). Named rather than inlined into webhooks.py
    so it isn't duplicating create_task's own Task-construction logic."""
    task = Task(**payload.model_dump(), status="pending")
    db.add(task)
    await db.flush()
    await _dispatch_or_block(db, task)
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID, payload: TaskUpdate, db: AsyncSession = Depends(get_db)
) -> Task:
    """Manual field override (e.g. dragging a Kanban card to a new column).
    Does NOT trigger execution — only /execute (or the webhook) actually
    dispatches to Celery. Trusts the caller's value with no state-machine
    validation, same as agents.py's update_agent."""
    task = await _get_task_or_404(task_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    # Only dispatch_task/_mark_failed/_maybe_complete_parent emitted this
    # before — without it, a status change made here (not by the worker)
    # wouldn't show up live on any *other* connected client's board.
    emit_task_status(str(task.id), task.status)
    return task
