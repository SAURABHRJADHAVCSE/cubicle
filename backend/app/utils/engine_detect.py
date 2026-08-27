"""Detect which agent engines are installed/configured on this host."""

import shutil

import httpx

from app.config import get_settings
from app.database import worker_session_factory
from app.engines.generic_cli import PROVIDER_BINARIES
from app.utils.secrets_store import CLAUDE_OAUTH_TOKEN_KEY, get_encrypted_setting


async def check_ollama(base_url: str) -> bool:
    """Return True if an Ollama server responds at ``base_url``."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/api/tags", timeout=2.0)
            return response.status_code == 200
    except httpx.HTTPError:
        return False


async def _claude_code_ready() -> bool:
    """The `claude` binary being on PATH isn't enough to actually run a
    task — it also needs the OAuth token connected via Settings (see
    app.engines.claude_code's docstring). Reporting "detected" on the
    binary alone let agents get created against Claude Code CLI with no
    working credentials, failing every task with an opaque "claude CLI
    exited 1" the first time anyone tried to use them."""
    if shutil.which("claude") is None:
        return False
    async with worker_session_factory() as session:
        token = await get_encrypted_setting(session, CLAUDE_OAUTH_TOKEN_KEY)
    return token is not None


async def detect_engines() -> dict[str, bool]:
    """Report availability of every engine Cubicle currently supports."""
    settings = get_settings()
    engines = {
        "claude_code": await _claude_code_ready(),
        "opencode": shutil.which("opencode") is not None,
        "ollama": await check_ollama(settings.ollama_base_url),
        "anthropic_api": bool(settings.anthropic_api_key),
    }
    for provider, binary in PROVIDER_BINARIES.items():
        engines[provider] = shutil.which(binary) is not None
    return engines
