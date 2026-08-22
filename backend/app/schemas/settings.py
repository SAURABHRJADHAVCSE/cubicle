"""Request/response schemas for the settings/engine-connection API."""

from pydantic import BaseModel


class ClaudeAuthStartResponse(BaseModel):
    auth_url: str


class ClaudeAuthCompleteRequest(BaseModel):
    code: str


class ClaudeAuthStatusResponse(BaseModel):
    connected: bool
