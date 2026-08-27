"""Request/response schemas for instance auth and device pairing."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuthStatusResponse(BaseModel):
    password_set: bool


class SetupRequest(BaseModel):
    password: str
    device_name: str = "Web browser"


class LoginRequest(BaseModel):
    password: str
    device_name: str = "Web browser"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeviceTokenResponse(BaseModel):
    token: str
    device_id: UUID
    device_name: str


class PairingTokenResponse(BaseModel):
    token: str
    expires_in: int


class PairRequest(BaseModel):
    pairing_token: str
    device_name: str = "Mobile device"


class DeviceOut(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    last_seen_at: datetime

    model_config = {"from_attributes": True}


class PushSubscriptionRequest(BaseModel):
    subscription: dict


class PushConfigResponse(BaseModel):
    configured: bool
    vapid_public_key: str | None = None
