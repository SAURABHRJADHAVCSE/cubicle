"""Tests for app.config.Settings."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_loads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("REDIS_URL", "redis://host:6379/0")

    settings = Settings()

    assert settings.database_url == "postgresql+asyncpg://u:p@host/db"
    assert settings.redis_url == "redis://host:6379/0"
    assert settings.env == "development"


def test_settings_requires_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("REDIS_URL", "redis://host:6379/0")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)  # type: ignore[call-arg]


def test_settings_requires_redis_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.delenv("REDIS_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)  # type: ignore[call-arg]
