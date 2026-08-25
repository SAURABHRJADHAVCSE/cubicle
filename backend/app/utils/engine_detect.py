"""Detect which agent engines are installed/configured on this host."""

import shutil

import httpx

from app.config import get_settings
from app.engines.generic_cli import PROVIDER_BINARIES


async def check_ollama(base_url: str) -> bool:
    """Return True if an Ollama server responds at ``base_url``."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/api/tags", timeout=2.0)
            return response.status_code == 200
    except httpx.HTTPError:
        return False


async def detect_engines() -> dict[str, bool]:
    """Report availability of every engine Cubicle currently supports."""
    settings = get_settings()
    engines = {
        "claude_code": shutil.which("claude") is not None,
        "opencode": shutil.which("opencode") is not None,
        "ollama": await check_ollama(settings.ollama_base_url),
        "anthropic_api": bool(settings.anthropic_api_key),
    }
    for provider, binary in PROVIDER_BINARIES.items():
        engines[provider] = shutil.which(binary) is not None
    return engines
