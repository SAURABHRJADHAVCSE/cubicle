"""FastAPI application entrypoint: app instance, lifespan, logging, routers."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import socketio
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi import Depends

from app.api import (
    agents,
    auth,
    calls,
    chat,
    devices,
    engines,
    health,
    settings as settings_api,
    tasks,
    webhooks,
)
from app.api.deps import get_current_device
from app.config import get_settings
from app.database import engine
from app.ws.manager import sio

settings = get_settings()


def configure_logging() -> None:
    """Configure structlog for JSON-structured application logs."""
    logging.basicConfig(level=settings.log_level, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


configure_logging()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup/shutdown of shared resources (the DB engine)."""
    logger.info("cubicle_api_startup", env=settings.env)
    yield
    await engine.dispose()
    logger.info("cubicle_api_shutdown")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public: needed before a client has a token at all (bootstrap/login) or
# harmless to leak (liveness).
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(devices.router)
# Also public: it isn't gated by device pairing at all — an external caller
# (CI, a script, a future Slack integration) authenticates via its own
# shared secret instead (see app.api.deps.verify_webhook_secret, applied
# per-route inside the router itself).
app.include_router(webhooks.router)

# Protected: every route here requires a valid device/browser bearer token.
_protected = Depends(get_current_device)
app.include_router(calls.router, dependencies=[_protected])
app.include_router(engines.router, dependencies=[_protected])
app.include_router(agents.router, dependencies=[_protected])
app.include_router(tasks.router, dependencies=[_protected])
app.include_router(chat.router, dependencies=[_protected])
app.include_router(settings_api.router, dependencies=[_protected])

# Wraps `app` so both plain HTTP routes and Socket.io's /socket.io/ path are
# served from one process; this is what uvicorn actually runs (see
# backend/Dockerfile's CMD). Tests import `app` directly and skip this
# wrapper since ASGITransport only needs the plain HTTP routes.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")
