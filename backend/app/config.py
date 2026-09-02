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
    # Web search/crawl (see app/search/). DB-stored setting from Settings ->
    # API Keys wins if both exist — same "env is a fallback" precedent as
    # anthropic_api_key above.
    tavily_api_key: str | None = None
    # Points at the host machine's own Ollama install via Docker Desktop's
    # host.docker.internal DNS name — not a Docker Compose "ollama" service
    # (none is defined; the user runs Ollama natively).
    ollama_base_url: str = "http://host.docker.internal:11434"
    embedding_model: str = "ollama/nomic-embed-text"
    embedding_dimensions: int = 768

    # Wall-clock cap on a single engine call (CLI subprocess or LLM API call)
    # — see engines/claude_code.py and engines/litellm_engine.py. Nothing
    # bounded this before; a hung CLI process or stalled API call could block
    # a Celery worker indefinitely. Celery's own task_time_limit (below) is a
    # coarser backstop, not the primary mechanism.
    task_timeout_seconds: int = 600
    # Rolling-24h spend ceiling checked before a task's engine call actually
    # starts (see workers/task_worker.py's cost-ceiling check). Unset = no
    # ceiling, same "unconfigured = off" pattern as the other optional
    # settings below.
    daily_cost_ceiling_usd: float | None = None
    # Caps how many levels deep an agent-calls-teammate-as-tool chain may
    # recurse (see workers/task_worker.py's call_chain guard) — independent
    # of litellm_engine.py's own per-turn tool-round cap, which bounds a
    # single agent's back-and-forth within one turn, not cross-agent depth.
    max_orchestration_depth: int = 4

    # POST /webhooks/tasks — lets an external system (CI, a script, a future
    # Slack integration) create+dispatch a task without a paired device.
    # Unset = the route 404s outright, not just 401s, so its existence isn't
    # even discoverable until an operator opts in. Generate one the same way
    # device tokens are generated: app.utils.tokens.generate_token().
    webhook_secret: str | None = None

    workspaces_dir: str = "/workspaces"
    # The host-machine path that workspaces_dir is bind-mounted from (see
    # docker-compose.yml's ./agent-workspaces:/workspaces). Purely cosmetic —
    # only used to hand the frontend a real, host-native path to display/copy
    # for "open this folder on my PC" — the container itself always reads and
    # writes through workspaces_dir regardless of whether this is set.
    host_workspaces_path: str | None = None

    # Extra explicit origins on top of cors_origin_regex below — normally
    # only needed for a public domain (e.g. a Caddy deployment) that isn't
    # itself a private-network address the regex already covers.
    cors_origins: list[str] = ["http://localhost:3000"]
    # Auto-allows any localhost/private-LAN/Tailscale origin so a phone on
    # the same Wi-Fi or a Tailscale-paired device just works with zero
    # config — CORS is a weak boundary for this app regardless (auth is a
    # bearer token this app's own JS attaches explicitly, not a cookie the
    # browser would auto-attach for a malicious third-party site, which is
    # the actual thing CORS defends against), so widening it here trades a
    # near-nonexistent security cost for a real usability win. Covers:
    # localhost/127.0.0.1, RFC1918 ranges (10/8, 172.16/12, 192.168/16),
    # Tailscale's CGNAT range (100.64.0.0/10), and *.ts.net MagicDNS names.
    cors_origin_regex: str = (
        r"^https?://("
        r"localhost"
        r"|127\.0\.0\.1"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}"
        r"|[a-zA-Z0-9.-]+\.ts\.net"
        r")(?::\d+)?$"
    )

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
