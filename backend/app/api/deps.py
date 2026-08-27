"""Shared FastAPI auth dependency.

There's no separate "user" concept — a browser tab that's passed the setup
password and a phone that's scanned a pairing QR code both end up as plain
rows in the `devices` table (see app.models.device), validated identically
here by bearer token.
"""

from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
