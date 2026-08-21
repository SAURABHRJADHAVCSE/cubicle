"""Semantic search over an agent's stored memories via pgvector."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.memory import AgentMemory
from app.utils.embeddings import aembed_text


async def get_relevant_memories(
    session: AsyncSession, agent: Agent, query: str, limit: int = 5
) -> list[str]:
    """Return up to `limit` memory snippets most semantically similar to `query`.

    Returns an empty list (rather than raising) if embedding the query
    fails — e.g. the local Ollama server isn't reachable — so chat still
    works without memory-augmented context.
    """
    try:
        query_embedding = await aembed_text(query)
    except Exception:  # noqa: BLE001 - memory is a nice-to-have, not chat-critical
        return []

    result = await session.execute(
        select(AgentMemory.content)
        .where(AgentMemory.agent_id == agent.id)
        .order_by(AgentMemory.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    return list(result.scalars().all())
