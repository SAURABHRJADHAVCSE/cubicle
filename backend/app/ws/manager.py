"""Socket.io server: pushes agent/task state changes to connected browsers.

Uses an AsyncRedisManager so events published by other processes (namely
the Celery worker, via app.ws.events' write-only RedisManager) are relayed
to whichever API replica each browser happens to be connected to.
"""

import socketio

from app.config import get_settings

settings = get_settings()

sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=socketio.AsyncRedisManager(settings.redis_url),
    cors_allowed_origins=settings.cors_origins,
)
