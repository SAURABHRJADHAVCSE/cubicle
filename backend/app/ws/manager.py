"""Socket.io server: pushes agent/task state changes to connected browsers.

Uses an AsyncRedisManager so events published by other processes (namely
the Celery worker, via app.ws.events' write-only RedisManager) are relayed
to whichever API replica each browser happens to be connected to.
"""

import socketio
from sqlalchemy import select

from app.config import get_settings
from app.database import async_session_factory
from app.models.device import Device
from app.utils.tokens import hash_token

settings = get_settings()

sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=socketio.AsyncRedisManager(settings.redis_url),
    cors_allowed_origins=settings.cors_origins,
)


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> None:
    """Rejects the connection unless `auth.token` matches a live device —
    mirrors the REST API's bearer-token check (app.api.deps)."""
    token = (auth or {}).get("token")
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("Missing auth token")

    async with async_session_factory() as db:
        result = await db.execute(select(Device).where(Device.token_hash == hash_token(token)))
        if result.scalar_one_or_none() is None:
            raise socketio.exceptions.ConnectionRefusedError("Invalid or revoked token")


@sio.event
async def disconnect(sid: str) -> None:
    await calls.handle_disconnect(sid)


# Imported at the bottom, not the top: calls.py does `from app.ws.manager
# import sio` at module scope, which only resolves once `sio` already
# exists as an attribute here — importing calls.py any earlier would be a
# circular import. This registers its `call:*` handlers on `sio` as a
# side effect of the import.
from app.ws import calls  # noqa: E402
