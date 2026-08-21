"""Health check endpoint."""

from typing import Literal

import structlog
from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

logger = structlog.get_logger()

router = APIRouter()


class HealthResponse(BaseModel):
    """Response body for /healthz."""

    status: Literal["ok", "error"]
    database: Literal["up", "down"]


@router.get("/healthz", response_model=HealthResponse)
async def healthz(response: Response, db: AsyncSession = Depends(get_db)) -> HealthResponse:
    """Report service health, including database connectivity.

    Redis is intentionally not checked here — nothing in Phase 1 uses it yet;
    its liveness is verified at the infra level via the compose healthcheck.
    """
    try:
        await db.execute(select(1))
    except Exception as exc:  # noqa: BLE001 - report any DB failure as unhealthy
        logger.error("healthz_db_check_failed", error=str(exc))
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status="error", database="down")

    return HealthResponse(status="ok", database="up")
