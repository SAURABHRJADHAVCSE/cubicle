"""Agent chat: conversation history + a message-send route that streams
the reply over Socket.io (see cubicle_spec.md Flow 3) as it's generated.
"""

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.engines.registry import get_engine
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.schemas.chat import ChatRequest, ConversationRead
from app.utils.memory_search import get_relevant_memories
from app.workers.memory_worker import store_memory
from app.ws.manager import sio

logger = structlog.get_logger()

router = APIRouter(prefix="/agents/{agent_id}", tags=["chat"])

HISTORY_LIMIT = 20


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.get("/conversations", response_model=list[ConversationRead])
async def list_conversations(
    agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[Conversation]:
    """Full chat history for an agent, oldest first."""
    await _get_agent_or_404(agent_id, db)
    result = await db.execute(
        select(Conversation)
        .where(Conversation.agent_id == agent_id)
        .order_by(Conversation.created_at)
    )
    return list(result.scalars().all())


@router.post("/chat", response_model=ConversationRead)
async def send_chat_message(
    agent_id: uuid.UUID, payload: ChatRequest, db: AsyncSession = Depends(get_db)
) -> Conversation:
    """Send a message to an agent; streams the reply over Socket.io as
    ``chat_chunk``/``chat_done`` events and returns the persisted reply.
    """
    agent = await _get_agent_or_404(agent_id, db)

    user_message = Conversation(agent_id=agent.id, role="user", content=payload.message)
    db.add(user_message)
    await db.commit()

    history_result = await db.execute(
        select(Conversation)
        .where(Conversation.agent_id == agent.id, Conversation.id != user_message.id)
        .order_by(Conversation.created_at.desc())
        .limit(HISTORY_LIMIT)
    )
    history = [
        {"role": "user" if turn.role == "user" else "assistant", "content": turn.content}
        for turn in reversed(history_result.scalars().all())
    ]

    memories = await get_relevant_memories(db, agent, payload.message)
    augmented_message = (
        f"[Relevant memory: {'; '.join(memories)}]\n\n{payload.message}"
        if memories
        else payload.message
    )

    engine = get_engine(agent)
    full_reply = ""
    try:
        async for delta in engine.chat_stream(augmented_message, history):
            full_reply += delta
            await sio.emit("chat_chunk", {"agent_id": str(agent.id), "delta": delta})
    except Exception as exc:  # noqa: BLE001 - surface engine failures as a chat message
        logger.error("chat_engine_failed", agent_id=str(agent.id), error=str(exc))
        full_reply = f"(chat failed: {exc})"

    agent_message = Conversation(agent_id=agent.id, role="agent", content=full_reply)
    db.add(agent_message)
    await db.commit()
    await db.refresh(agent_message)

    await sio.emit(
        "chat_done",
        {"agent_id": str(agent.id), "message": ConversationRead.model_validate(agent_message).model_dump(mode="json")},
    )

    store_memory.delay(
        str(agent.id),
        f"User asked: {payload.message}\n{agent.name} replied: {full_reply}",
        None,
        "conversation",
    )

    return agent_message
