"""Celery Beat task: periodic idle-detection / ambient social behavior.

Runs on a fixed interval (see `app/workers/__init__.py`'s `beat_schedule`)
and looks for agents that have been idle long enough to deserve a coffee
-break line, occasionally pairs two idle agents up for a "desk visit"
instead, and fires an end-of-day wind-down line once per day per agent.
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select

from app.database import worker_session_factory
from app.models.agent import Agent
from app.social.dialogue import generate_dialogue
from app.workers import app as celery_app
from app.ws.events import emit_social_event

logger = structlog.get_logger()

# Belongs in the same module as detect_social_triggers below (also a
# Celery task calling generate_dialogue) rather than in app/social/
# dialogue.py itself — see that module's docstring for why hosting a task
# there created a real import cycle.


@celery_app.task(name="generate_and_emit_dialogue")
def generate_and_emit_dialogue(
    agent_id: str, situation: str, event_type: str, fallback: str
) -> None:
    """Synchronous Celery entrypoint; fire-and-forget so callers (e.g.
    task_worker) never block on an LLM round-trip for a speech bubble."""
    asyncio.run(
        _generate_and_emit_dialogue_async(uuid.UUID(agent_id), situation, event_type, fallback)
    )


async def _generate_and_emit_dialogue_async(
    agent_id: uuid.UUID, situation: str, event_type: str, fallback: str
) -> None:
    async with worker_session_factory() as session:
        agent = await session.get(Agent, agent_id)
        if agent is None:
            logger.error("generate_and_emit_dialogue_missing_agent", agent_id=str(agent_id))
            return
        dialogue = await generate_dialogue(agent, situation, fallback)
        emit_social_event(str(agent.id), event_type, dialogue)

IDLE_COFFEE_THRESHOLD = timedelta(minutes=2)
TRIGGER_COOLDOWN = timedelta(minutes=5)
DESK_VISIT_CHANCE = 0.2
# Wall-clock (UTC) hour after which idle agents get a wind-down line —
# deduped per-agent per-day via last_social_trigger_at, not by trying to
# hit an exact tick, since Beat's 60s interval isn't guaranteed to land
# exactly on a minute boundary.
WINDDOWN_HOUR = 18


@celery_app.task(name="detect_social_triggers")
def detect_social_triggers() -> None:
    """Synchronous Celery Beat entrypoint; runs the async pass to completion."""
    asyncio.run(_detect_social_triggers_async())


async def _detect_social_triggers_async() -> None:
    async with worker_session_factory() as session:
        now = datetime.now(timezone.utc)
        result = await session.execute(select(Agent).where(Agent.status == "idle"))
        idle_agents = list(result.scalars().all())
        if not idle_agents:
            return

        winddown_agents = [
            a
            for a in idle_agents
            if now.hour >= WINDDOWN_HOUR
            and (a.last_social_trigger_at is None or a.last_social_trigger_at.date() < now.date())
        ]
        for agent in winddown_agents:
            dialogue = await generate_dialogue(
                agent, "wrapping up for the day", "Heading out, see you tomorrow!"
            )
            emit_social_event(str(agent.id), "winddown", dialogue)
            agent.last_social_trigger_at = now
        if winddown_agents:
            await session.commit()
            logger.info("social_winddown_fired", count=len(winddown_agents))

        remaining = [a for a in idle_agents if a not in winddown_agents]
        eligible = [
            a
            for a in remaining
            if now - a.status_changed_at >= IDLE_COFFEE_THRESHOLD
            and (a.last_social_trigger_at is None or now - a.last_social_trigger_at >= TRIGGER_COOLDOWN)
        ]
        if not eligible:
            return

        if len(eligible) >= 2 and random.random() < DESK_VISIT_CHANCE:
            visitor, target = random.sample(eligible, 2)
            dialogue = await generate_dialogue(
                visitor,
                f"stopping by {target.name}'s desk for a chat",
                f"Hey {target.name}!",
            )
            emit_social_event(str(visitor.id), "desk_visit", dialogue, str(target.id))
            visitor.last_social_trigger_at = now
            target.last_social_trigger_at = now
        else:
            for agent in eligible:
                dialogue = await generate_dialogue(agent, "taking a coffee break", "Coffee break ☕")
                emit_social_event(str(agent.id), "coffee", dialogue)
                agent.last_social_trigger_at = now

        await session.commit()
        logger.info("social_triggers_fired", count=len(eligible))
