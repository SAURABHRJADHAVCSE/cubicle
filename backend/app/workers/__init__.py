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
)

# Imported after `app` is defined so task_worker's `from app.workers import app`
# resolves without a real circular-import failure; this registers the tasks.
from app.workers import task_worker  # noqa: E402,F401
