"""Celery task: embed a piece of text and store it as an agent memory.

Runs on the same "tasks" queue as execute_task — a dedicated "memory" queue
(as sketched in cubicle_spec.md's compose command) isn't introduced yet
since nothing else needs the extra deployment complexity of a second queue
consumer for a single lightweight task type.
"""

import asyncio
import uuid

import structlog

from app.database import worker_session_factory
from app.models.memory import AgentMemory
from app.utils.embeddings import embed_text
from app.workers import app as celery_app

logger = structlog.get_logger()


@celery_app.task(name="store_memory")
def store_memory(
    agent_id: str,
    content: str,
    source_task_id: str | None = None,
    memory_type: str = "task",
) -> None:
    """Synchronous Celery entrypoint; runs the async DB insert to completion."""
    asyncio.run(
        _store_memory_async(uuid.UUID(agent_id), content, source_task_id, memory_type)
    )


async def _store_memory_async(
    agent_id: uuid.UUID,
    content: str,
    source_task_id: str | None,
    memory_type: str,
) -> None:
    try:
        embedding = embed_text(content)
    except Exception as exc:  # noqa: BLE001 - embedding failures shouldn't crash the task/chat flow
        logger.error("store_memory_embedding_failed", agent_id=str(agent_id), error=str(exc))
        return

    async with worker_session_factory() as session:
        memory = AgentMemory(
            agent_id=agent_id,
            content=content,
            embedding=embedding,
            source_task_id=uuid.UUID(source_task_id) if source_task_id else None,
            memory_type=memory_type,
        )
        session.add(memory)
        await session.commit()
        logger.info("store_memory_completed", agent_id=str(agent_id), memory_type=memory_type)
