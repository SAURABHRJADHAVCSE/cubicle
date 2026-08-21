"""Celery task: execute a Task against its first assigned agent's engine."""

import asyncio
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.engines.registry import get_engine
from app.models.agent import Agent
from app.models.task import Task
from app.workers import app as celery_app
from app.ws.events import emit_agent_status, emit_task_status

logger = structlog.get_logger()


@celery_app.task(name="execute_task")
def execute_task(task_id: str) -> None:
    """Synchronous Celery entrypoint; runs the async implementation to completion."""
    asyncio.run(_execute_task_async(uuid.UUID(task_id)))


async def _execute_task_async(task_id: uuid.UUID) -> None:
    """Load the task and its agent, run the engine, and persist the result."""
    async with async_session_factory() as session:
        task = await session.get(Task, task_id)
        if task is None:
            logger.error("execute_task_missing_task", task_id=str(task_id))
            return

        if not task.assigned_agents:
            await _mark_failed(session, task, "Task has no assigned agents")
            return

        agent = await session.get(Agent, task.assigned_agents[0])
        if agent is None:
            await _mark_failed(session, task, "Assigned agent not found")
            return

        task.status = "in_progress"
        task.started_at = datetime.now(timezone.utc)
        agent.status = "working"
        agent.current_task_id = task.id
        await session.commit()
        emit_task_status(str(task.id), task.status)
        emit_agent_status(str(agent.id), agent.status, agent.mood, str(task.id))

        try:
            engine = get_engine(agent)
            result = await engine.execute(
                task.brief,
                context={
                    "system_prompt": f"You are {agent.name}, a {agent.role}.",
                    "working_dir": agent.working_directory,
                },
            )
        except Exception as exc:  # noqa: BLE001 - any engine failure marks the task failed
            logger.error("execute_task_failed", task_id=str(task.id), error=str(exc))
            await _mark_failed(session, task, str(exc), agent=agent)
            return

        task.status = "completed"
        task.result_raw = result.raw_output or result.output
        task.result_structured = result.structured
        task.result_files = result.files_changed or None
        task.tokens_used = result.tokens_used
        task.cost_usd = result.cost_usd
        task.completed_at = datetime.now(timezone.utc)

        agent.status = "idle"
        agent.current_task_id = None

        await session.commit()
        emit_task_status(str(task.id), task.status)
        emit_agent_status(str(agent.id), agent.status, agent.mood, None)
        logger.info("execute_task_completed", task_id=str(task.id))


async def _mark_failed(
    session: AsyncSession, task: Task, error: str, agent: Agent | None = None
) -> None:
    """Record a task failure and free up its agent, if any."""
    task.status = "failed"
    task.result_raw = error
    task.completed_at = datetime.now(timezone.utc)
    if agent is not None:
        agent.status = "idle"
        agent.current_task_id = None
    await session.commit()
    emit_task_status(str(task.id), task.status)
    if agent is not None:
        emit_agent_status(str(agent.id), agent.status, agent.mood, None)
