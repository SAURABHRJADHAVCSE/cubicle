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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return the cached, process-wide Settings instance."""
    return Settings()
