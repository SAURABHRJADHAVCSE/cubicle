"""Celery application instance for Cubicle background task execution."""

from celery import Celery

from app.config import get_settings

settings = get_settings()

app = Celery("cubicle", broker=settings.redis_url)

app.conf.update(
    task_default_queue="tasks",
    task_ignore_result=True,
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    # Backstop only — the primary timeout is the asyncio.wait_for() inside
    # each engine's execute() (see claude_code.py/litellm_engine.py), which
    # produces a clean `failed` task record. This is a coarser last resort
    # for a hang that mechanism somehow doesn't catch: under the default
    # prefork pool, exceeding task_time_limit SIGKILLs the worker child
    # process (Celery auto-respawns it) without writing a task result at
    # all, so it's strictly worse than the in-process path succeeding.
    task_soft_time_limit=settings.task_timeout_seconds + 30,
    task_time_limit=settings.task_timeout_seconds + 60,
    beat_schedule={
        "detect-social-triggers": {
            "task": "detect_social_triggers",
            "schedule": 60.0,
        },
    },
)

# Imported after `app` is defined so task_worker's `from app.workers import app`
# resolves without a real circular-import failure; this registers the tasks.
# Order matters: social_worker before task_worker, since task_worker imports
# generate_and_emit_dialogue from social_worker.
from app.workers import memory_worker, social_worker, task_worker  # noqa: E402,F401
