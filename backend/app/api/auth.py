"""Instance auth: a single setup password gates both the web dashboard and
device pairing (see app.api.deps / app.models.device for the device-token
model this issues into).
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.device import Device
from app.schemas.auth import (
    AuthStatusResponse,
    DeviceTokenResponse,
    LoginRequest,
    SetupRequest,
)
from app.utils.passwords import hash_password, verify_password
from app.utils.secrets_store import get_plain_setting, set_plain_setting
from app.utils.tokens import generate_token, hash_token

logger = structlog.get_logger()

router = APIRouter(prefix="/auth", tags=["auth"])

INSTANCE_PASSWORD_KEY = "instance_password_hash"


async def issue_device(db: AsyncSession, name: str) -> DeviceTokenResponse:
    token = generate_token()
    device = Device(name=name, token_hash=hash_token(token))
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return DeviceTokenResponse(token=token, device_id=device.id, device_name=device.name)


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(db: AsyncSession = Depends(get_db)) -> AuthStatusResponse:
    """Whether this instance has a setup password yet — drives whether the
    frontend shows "Set up" or "Log in"."""
    stored = await get_plain_setting(db, INSTANCE_PASSWORD_KEY)
    return AuthStatusResponse(password_set=stored is not None)


@router.post("/setup", response_model=DeviceTokenResponse)
async def setup(payload: SetupRequest, db: AsyncSession = Depends(get_db)) -> DeviceTokenResponse:
    """First-run only: sets the instance password and immediately logs in
    the browser that set it, so there's no separate login step right after."""
    if await get_plain_setting(db, INSTANCE_PASSWORD_KEY) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="This instance already has a password set"
        )
    if len(payload.password) < 8:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters"
        )
    await set_plain_setting(db, INSTANCE_PASSWORD_KEY, hash_password(payload.password))
    logger.info("instance_password_set")
    return await issue_device(db, payload.device_name)


@router.post("/login", response_model=DeviceTokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> DeviceTokenResponse:
    stored = await get_plain_setting(db, INSTANCE_PASSWORD_KEY)
    if stored is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No password set yet — use /auth/setup first"
        )
    if not verify_password(payload.password, stored):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")
    return await issue_device(db, payload.device_name)
