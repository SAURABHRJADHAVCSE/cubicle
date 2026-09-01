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


def emit_task_deleted(task_id: str) -> None:
    """Broadcast that a task was removed, so every other connected client
    drops it from its own task feed instead of only the deleting client."""
    _emitter.emit("task_deleted", {"task_id": task_id})


def emit_celebration(agent_id: str) -> None:
    """Trigger a one-off celebration animation for an agent (task completed)."""
    _emitter.emit("celebration", {"agent_id": agent_id})


def emit_social_event(
    agent_id: str, event_type: str, dialogue: str, target_agent_id: str | None = None
) -> None:
    """Broadcast a speech-bubble-worthy social event (work chat, coffee, etc.)."""
    _emitter.emit(
        "social_event",
        {
            "agent_id": agent_id,
            "event_type": event_type,
            "dialogue": dialogue,
            "target_agent_id": target_agent_id,
        },
    )
