"""Task CRUD + execution API routes."""

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskRead
from app.workers.task_worker import execute_task, route_task

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
    """Dispatch a pending task to a Celery worker for execution."""
    task = await _get_task_or_404(task_id, db)
    if task.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Task is '{task.status}', not 'pending' — cannot execute again",
        )

    task.status = "assigned"
    await db.commit()
    await db.refresh(task)

    if task.orchestrator_agent_id is not None:
        route_task.delay(str(task.id))
        logger.info("task_routed", task_id=str(task.id))
    else:
        execute_task.delay(str(task.id))
        logger.info("task_dispatched", task_id=str(task.id))
    return task
