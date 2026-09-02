"""Settings API: currently just the Claude Code CLI subscription connection.

cubicle_spec.md's V1.0 scope has a full settings page (all engine configs,
API keys, social toggles) backed by the `settings` table — this route only
covers the one thing that genuinely can't be a plain env var (an
interactive OAuth handshake). Broader settings CRUD is still V1.0 scope.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.settings import (
    ApiKeysStatus,
    ApiKeysUpdate,
    ClaudeAuthCompleteRequest,
    ClaudeAuthStartResponse,
    ClaudeAuthStatusResponse,
)
from app.utils.claude_auth import acancel_claude_auth, astart_claude_auth, asubmit_claude_auth_code
from app.utils.secrets_store import (
    ANTHROPIC_API_KEY_SETTING,
    CLAUDE_OAUTH_TOKEN_KEY,
    SARVAM_API_KEY_SETTING,
    TAVILY_API_KEY_SETTING,
    delete_setting,
    get_encrypted_setting,
    set_encrypted_setting,
)

logger = structlog.get_logger()

router = APIRouter(prefix="/settings/claude-auth", tags=["settings"])
api_keys_router = APIRouter(prefix="/settings/api-keys", tags=["settings"])


@router.get("/status", response_model=ClaudeAuthStatusResponse)
async def claude_auth_status(db: AsyncSession = Depends(get_db)) -> ClaudeAuthStatusResponse:
    """Whether a Claude Code OAuth token is stored."""
    token = await get_encrypted_setting(db, CLAUDE_OAUTH_TOKEN_KEY)
    return ClaudeAuthStatusResponse(connected=token is not None)


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
async def claude_auth_complete(
    payload: ClaudeAuthCompleteRequest, db: AsyncSession = Depends(get_db)
) -> None:
    """Finish the OAuth flow with the code the user pasted back, and store
    the resulting long-lived token (encrypted) for engines to use."""
    try:
        token = await asubmit_claude_auth_code(payload.code)
    except RuntimeError as exc:
        logger.error("claude_auth_complete_failed", error=str(exc))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await set_encrypted_setting(db, CLAUDE_OAUTH_TOKEN_KEY, token)
    logger.info("claude_auth_token_stored")


@router.post("/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def claude_auth_cancel() -> None:
    """Abort a pending connection attempt the user backed out of."""
    await acancel_claude_auth()


async def _api_keys_status(db: AsyncSession) -> ApiKeysStatus:
    return ApiKeysStatus(
        has_anthropic_key=await get_encrypted_setting(db, ANTHROPIC_API_KEY_SETTING) is not None,
        has_sarvam_key=await get_encrypted_setting(db, SARVAM_API_KEY_SETTING) is not None,
        has_tavily_key=await get_encrypted_setting(db, TAVILY_API_KEY_SETTING) is not None,
    )


@api_keys_router.get("", response_model=ApiKeysStatus)
async def get_api_keys(db: AsyncSession = Depends(get_db)) -> ApiKeysStatus:
    """Whether a global Anthropic/Sarvam/Tavily API key is configured from
    Settings — the actual keys are never returned. Consumed by
    engines/litellm_engine.py's _resolve_api_key, voice/registry.py's
    _resolve_sarvam_key, and search/registry.py's get_search_provider,
    which prefer these over the ANTHROPIC_API_KEY/SARVAM_API_KEY/
    TAVILY_API_KEY env vars when set."""
    return await _api_keys_status(db)


@api_keys_router.put("", response_model=ApiKeysStatus)
async def update_api_keys(
    payload: ApiKeysUpdate, db: AsyncSession = Depends(get_db)
) -> ApiKeysStatus:
    """Per field: omitted = leave whatever's stored untouched, "" =
    explicitly clear it, a value = set/rotate it — same contract as
    AgentUpdate.engine_api_key in api/agents.py."""
    fields_sent = payload.model_fields_set
    for field, key in (
        ("anthropic_api_key", ANTHROPIC_API_KEY_SETTING),
        ("sarvam_api_key", SARVAM_API_KEY_SETTING),
        ("tavily_api_key", TAVILY_API_KEY_SETTING),
    ):
        if field not in fields_sent:
            continue
        value = getattr(payload, field)
        if value:
            await set_encrypted_setting(db, key, value)
        else:
            await delete_setting(db, key)
    logger.info("api_keys_updated", fields=sorted(fields_sent))
    return await _api_keys_status(db)
