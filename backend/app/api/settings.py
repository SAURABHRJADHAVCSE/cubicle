"""Settings API: currently just the Claude Code CLI subscription connection.

cubicle_spec.md's V1.0 scope has a full settings page (all engine configs,
API keys, social toggles) backed by the `settings` table — this route only
covers the one thing that genuinely can't be a plain env var (an
interactive OAuth handshake). Broader settings CRUD is still V1.0 scope.
"""

import structlog
from fastapi import APIRouter, HTTPException, status

from app.schemas.settings import (
    ClaudeAuthCompleteRequest,
    ClaudeAuthStartResponse,
    ClaudeAuthStatusResponse,
)
from app.utils.claude_auth import (
    acancel_claude_auth,
    aget_claude_auth_status,
    astart_claude_auth,
    asubmit_claude_auth_code,
)

logger = structlog.get_logger()

router = APIRouter(prefix="/settings/claude-auth", tags=["settings"])


@router.get("/status", response_model=ClaudeAuthStatusResponse)
async def claude_auth_status() -> ClaudeAuthStatusResponse:
    """Whether the Claude Code CLI has a stored subscription session."""
    status_data = await aget_claude_auth_status()
    return ClaudeAuthStatusResponse(
        logged_in=bool(status_data.get("loggedIn")),
        auth_method=status_data.get("authMethod", "none"),
    )


@router.post("/start", response_model=ClaudeAuthStartResponse)
async def claude_auth_start() -> ClaudeAuthStartResponse:
    """Begin the OAuth flow; returns the URL the user needs to open."""
    try:
        auth_url = await astart_claude_auth()
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except TimeoutError as exc:
        logger.error("claude_auth_start_timeout", error=str(exc))
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, detail=str(exc)) from exc
    return ClaudeAuthStartResponse(auth_url=auth_url)


@router.post("/complete", status_code=status.HTTP_204_NO_CONTENT)
async def claude_auth_complete(payload: ClaudeAuthCompleteRequest) -> None:
    """Finish the OAuth flow with the code the user pasted back."""
    try:
        await asubmit_claude_auth_code(payload.code)
    except RuntimeError as exc:
        logger.error("claude_auth_complete_failed", error=str(exc))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def claude_auth_cancel() -> None:
    """Abort a pending connection attempt the user backed out of."""
    await acancel_claude_auth()
