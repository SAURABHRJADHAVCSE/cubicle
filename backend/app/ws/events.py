"""Emit helpers for pushing agent/task state changes to connected clients.

Called from the Celery worker process — a different process than the
FastAPI server — so this uses Socket.io's write-only RedisManager to
publish through Redis rather than talking to app.ws.manager's AsyncServer
directly. The API process's AsyncRedisManager picks these up and relays
them to browsers.
"""

import socketio

from app.config import get_settings

_settings = get_settings()
_emitter = socketio.RedisManager(_settings.redis_url, write_only=True)


def emit_agent_status(
    agent_id: str, status: str, mood: str, current_task_id: str | None
) -> None:
    """Broadcast an agent's updated status/mood/current task to all clients."""
    _emitter.emit(
        "agent_status",
        {
            "agent_id": agent_id,
            "status": status,
            "mood": mood,
            "current_task_id": current_task_id,
        },
    )


def emit_task_status(task_id: str, status: str) -> None:
    """Broadcast a task's updated status to all clients."""
    _emitter.emit("task_status", {"task_id": task_id, "status": status})
