"""Request/response schemas for the settings/engine-connection API."""

from pydantic import BaseModel


class ClaudeAuthStartResponse(BaseModel):
    auth_url: str


class ClaudeAuthCompleteRequest(BaseModel):
    code: str


class ClaudeAuthStatusResponse(BaseModel):
    connected: bool


class ApiKeysStatus(BaseModel):
    """Never the raw keys — just whether each is configured (same contract
    as Agent.has_engine_api_key)."""

    has_anthropic_key: bool
    has_sarvam_key: bool


class ApiKeysUpdate(BaseModel):
    """Plaintext here only — encrypted before storage. Per field: omitted
    = leave whatever's stored untouched, "" = explicitly clear it, a value
    = set/rotate it. Same contract as AgentUpdate.engine_api_key."""

    anthropic_api_key: str | None = None
    sarvam_api_key: str | None = None
