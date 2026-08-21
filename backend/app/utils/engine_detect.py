"""Detect which agent engines are installed/configured on this host."""

import shutil

import httpx

from app.config import get_settings


async def check_ollama(base_url: str) -> bool:
    """Return True if an Ollama server responds at ``base_url``."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/api/tags", timeout=2.0)
            return response.status_code == 200
    except httpx.HTTPError:
        return False


async def detect_engines() -> dict[str, bool]:
    """Report availability of every engine Phase 2 supports.

    Codex/Grok/Antigravity/Qwen/OpenCode and friends are V0.2 scope
    (cubicle_spec.md §9) and are intentionally not probed here yet.
    """
    settings = get_settings()
    return {
        "claude_code": shutil.which("claude") is not None,
        "ollama": await check_ollama(settings.ollama_base_url),
        "anthropic_api": bool(settings.anthropic_api_key),
    }
