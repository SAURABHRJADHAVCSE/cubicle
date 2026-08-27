"""Application configuration loaded from environment variables via pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Cubicle backend settings, sourced from the environment / .env file."""

    app_name: str = "Cubicle"
    env: Literal["development", "production", "test"] = "development"
    log_level: str = "INFO"

    database_url: str
    redis_url: str

    anthropic_api_key: str | None = None
    # Points at the host machine's own Ollama install via Docker Desktop's
    # host.docker.internal DNS name — not a Docker Compose "ollama" service
    # (none is defined; the user runs Ollama natively).
    ollama_base_url: str = "http://host.docker.internal:11434"
    embedding_model: str = "ollama/nomic-embed-text"
    embedding_dimensions: int = 768

    workspaces_dir: str = "/workspaces"

    cors_origins: list[str] = ["http://localhost:3000"]

    # Derives the key used to encrypt settings values at rest (e.g. the
    # Claude Code OAuth token) — see app/utils/encryption.py. Not set by
    # default: encrypting secrets with a key that isn't actually secret
    # defeats the point, so this must come from the user's own .env.
    secret_key: str | None = None

    # Web Push (task-completed/failed notifications to paired devices).
    # Generate a pair with `vapid --gen` (from the pywebpush package) or
    # `python -m py_vapid`. Unset means push notifications are silently
    # skipped, same "not configured" pattern as the other optional keys.
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str = "mailto:admin@localhost"

    # Voice calls (see app/voice/ and app/ws/calls.py). STT/TTS: unset means
    # calls still connect and prove the transport via a test-tone/echo
    # fallback (see app/voice/pipeline.py) — same "not configured" pattern
    # as everything else optional here.
    sarvam_api_key: str | None = None
    # ICE: STUN alone is enough over Tailscale (a flat private network needs
    # no relay); TURN is only required to reach this instance over
    # Cloudflare Tunnel or a public VPS, since Cloudflare Tunnel has no UDP
    # passthrough for raw WebRTC media. Point turn_url at the coturn service
    # in docker-compose.yml (docker-compose.yml can't guess your externally
    # -reachable address, so this is unset/STUN-only by default).
    stun_url: str = "stun:stun.l.google.com:19302"
    turn_url: str | None = None
    turn_username: str | None = None
    turn_credential: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return the cached, process-wide Settings instance."""
    return Settings()
