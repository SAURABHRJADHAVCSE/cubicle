"""Create/read round-trip tests for the Conversation model."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Agent, Conversation


async def test_conversation_round_trip_and_defaults(db_session: AsyncSession) -> None:
    agent = Agent(
        name="Priya",
        role="Screener",
        engine_type="api",
        engine_provider="anthropic",
        personality_traits=["extrovert"],
    )
    db_session.add(agent)
    await db_session.flush()

    message = Conversation(agent_id=agent.id, role="user", content="How's it going?")
    db_session.add(message)
    await db_session.flush()
    await db_session.refresh(message)

    fetched = (
        await db_session.execute(select(Conversation).where(Conversation.id == message.id))
    ).scalar_one()

    assert fetched.role == "user"
    assert fetched.content == "How's it going?"
    assert fetched.message_type == "chat"
    assert fetched.created_at is not None
