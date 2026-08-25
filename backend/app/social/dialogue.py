"""Cheap-LLM social dialogue generation — short personality-flavored lines
for speech bubbles, celebrations, and social-scheduler events.

Deliberately has zero dependency on `app.workers`: this used to also host
the Celery task wrapper (`generate_and_emit_dialogue`), which required
importing `app.workers.app` — but `app/workers/__init__.py` imports
`app.workers.social_worker`, which needs `generate_dialogue` from this
module, so that made a real import cycle (only "resolved" by luck of which
module happened to import `app.workers` first). The Celery task wrapper now
lives in `app/workers/social_worker.py` instead, alongside the scheduler
task that also calls `generate_dialogue` — this module stays a plain,
freely-importable helper.
"""

import structlog

from app.config import get_settings
from app.engines.litellm_engine import LiteLLMEngine
from app.models.agent import Agent

logger = structlog.get_logger()


async def generate_dialogue(agent: Agent, situation: str, fallback: str) -> str:
    """Generate one short, personality-flavored office line via a cheap LLM.

    Deliberately forces a fixed cheap Ollama model rather than routing
    through the agent's own configured engine (`get_engine(agent)`) — a
    one-line quip shouldn't invoke an agent's real (possibly expensive CLI)
    engine. Never raises: any failure here (Ollama not running, model
    error, ...) falls back to the caller-supplied canned line, since this
    sits in the middle of real task-execution and social-scheduler flows
    that must not break because a speech bubble failed to generate.
    """
    try:
        personality = ", ".join(agent.personality_traits or []) or "professional"
        prompt = (
            f"{agent.name} is {personality}. Situation: {situation}. "
            "Write ONE casual office line (max 10 words)."
        )
        # Must be a model actually pulled in the user's local Ollama — there's
        # no catalog/availability check here (that would be a second round
        # -trip for a one-line quip), so a wrong name just means every call
        # falls through to the canned fallback via the except below.
        engine = LiteLLMEngine(model="ollama/llama3.1:8b", api_base=get_settings().ollama_base_url)
        result = await engine.execute(
            prompt,
            context={
                "system_prompt": (
                    "You write short, casual office chatter for a workplace "
                    "simulation. Reply with just the line — no quotes, no "
                    "preamble, no emoji."
                )
            },
        )
        line = result.output.strip().strip('"').strip()
        return line[:120] if line else fallback
    except Exception as exc:  # noqa: BLE001 - any LLM failure falls back to canned text
        logger.warning("generate_dialogue_failed", agent_id=str(agent.id), error=str(exc))
        return fallback
