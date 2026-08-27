"""Device pairing (mobile QR/token flow) and device management."""

import json
import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import issue_device
from app.api.deps import get_current_device
from app.config import get_settings
from app.database import get_db
from app.models.device import Device
from app.schemas.auth import (
    DeviceOut,
    DeviceTokenResponse,
    PairingTokenResponse,
    PairRequest,
    PushConfigResponse,
    PushSubscriptionRequest,
)
from app.utils.pairing_store import consume_pairing_token, create_pairing_token
from app.utils.push import push_configured

logger = structlog.get_logger()

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post(
    "/pairing-token",
    response_model=PairingTokenResponse,
    dependencies=[Depends(get_current_device)],
)
async def create_pairing_token_route() -> PairingTokenResponse:
    """Called from an already-authenticated browser to generate a
    short-lived code for the QR shown in Settings → Devices."""
    token, ttl = await create_pairing_token()
    return PairingTokenResponse(token=token, expires_in=ttl)


@router.post("/pair", response_model=DeviceTokenResponse)
async def pair(payload: PairRequest, db: AsyncSession = Depends(get_db)) -> DeviceTokenResponse:
    """Redeems a pairing token (scanned from the QR, or typed in manually)
    for a long-lived device token. Deliberately unauthenticated — the
    pairing token itself, minted by an already-logged-in browser, is the
    credential here."""
    if not await consume_pairing_token(payload.pairing_token):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Pairing code is invalid, expired, or already used"
        )
    logger.info("device_paired", device_name=payload.device_name)
    return await issue_device(db, payload.device_name)


@router.get("", response_model=list[DeviceOut], dependencies=[Depends(get_current_device)])
async def list_devices(db: AsyncSession = Depends(get_db)) -> list[Device]:
    result = await db.execute(select(Device).order_by(Device.last_seen_at.desc()))
    return list(result.scalars().all())


@router.get("/push-config", response_model=PushConfigResponse, dependencies=[Depends(get_current_device)])
async def push_config() -> PushConfigResponse:
    """The public VAPID key the frontend needs to call
    `pushManager.subscribe({ applicationServerKey: ... })` — safe to expose
    to any authenticated device, it's the public half of the key pair."""
    settings = get_settings()
    return PushConfigResponse(
        configured=push_configured(),
        vapid_public_key=settings.vapid_public_key,
    )


@router.put("/me/push-subscription", status_code=status.HTTP_204_NO_CONTENT)
async def save_push_subscription(
    payload: PushSubscriptionRequest,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> None:
    device.push_subscription = json.dumps(payload.subscription)
    await db.commit()


@router.delete("/me/push-subscription", status_code=status.HTTP_204_NO_CONTENT)
async def delete_push_subscription(
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> None:
    device.push_subscription = None
    await db.commit()


@router.delete(
    "/{device_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_device)]
)
async def revoke_device(device_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Revokes a device's access immediately — including, if you delete
    your own current session, yourself (the frontend should warn for that)."""
    device = await db.get(Device, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Device not found")
    await db.delete(device)
    await db.commit()
