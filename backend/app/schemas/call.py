"""Request/response schemas for the voice-call config endpoint."""

from pydantic import BaseModel


class CallConfigResponse(BaseModel):
    ice_servers: list[dict]
    voice_configured: bool
