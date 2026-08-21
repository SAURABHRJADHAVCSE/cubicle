"""FastAPI application entrypoint: app instance, lifespan, logging, routers."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import socketio
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, chat, engines, health, tasks
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(engines.router)
app.include_router(agents.router)
app.include_router(tasks.router)
app.include_router(chat.router)

# Wraps `app` so both plain HTTP routes and Socket.io's /socket.io/ path are
# served from one process; this is what uvicorn actually runs (see
# backend/Dockerfile's CMD). Tests import `app` directly and skip this
# wrapper since ASGITransport only needs the plain HTTP routes.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")
