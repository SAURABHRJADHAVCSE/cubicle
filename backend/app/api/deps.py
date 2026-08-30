"""Shared FastAPI auth dependency.

There's no separate "user" concept — a browser tab that's passed the setup
password and a phone that's scanned a pairing QR code both end up as plain
rows in the `devices` table (see app.models.device), validated identically
here by bearer token.
"""

import hmac
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.models.device import Device
from app.utils.tokens import hash_token


async def get_current_device(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Device:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header"
        )
    token = authorization.split(" ", 1)[1].strip()

    result = await db.execute(select(Device).where(Device.token_hash == hash_token(token)))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked token")

    device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    return device


async def verify_webhook_secret(
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    settings: Settings = Depends(get_settings),
) -> None:
    """Separate from get_current_device: an external system (CI, a script)
    has no paired device to authenticate as. Unconfigured means 404, not
    401 — the route's existence isn't discoverable until an operator opts
    in by setting WEBHOOK_SECRET."""
    if settings.webhook_secret is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not Found")
    if not x_webhook_secret or not hmac.compare_digest(x_webhook_secret, settings.webhook_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")
