"""Tests for voice/registry.py's provider selection — mirrors
test_engines/test_registry.py's shape, adapted for the async
DB-then-env key resolution added alongside Settings -> Engine Providers."""

from types import SimpleNamespace

import pytest

from app.voice import registry as voice_registry_module
from app.voice.stt import SarvamSTT
from app.voice.tts import SarvamTTS


class _NoOpSessionCM:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc_info: object) -> bool:
        return False


async def test_get_stt_provider_prefers_configured_secret_over_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_configured_secret(session, key, env_fallback):
        assert key == "sarvam_api_key"
        assert env_fallback == "env-key"
        return "db-key"

    fake_settings = SimpleNamespace(sarvam_api_key="env-key")
    monkeypatch.setattr(voice_registry_module, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(
        voice_registry_module, "get_configured_secret", fake_get_configured_secret
    )
    monkeypatch.setattr(voice_registry_module, "worker_session_factory", lambda: _NoOpSessionCM())

    provider = await voice_registry_module.get_stt_provider()

    assert isinstance(provider, SarvamSTT)
    assert provider.api_key == "db-key"


async def test_get_tts_provider_falls_back_to_env_when_nothing_stored(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_configured_secret(session, key, env_fallback):
        return env_fallback  # nothing stored — mirrors get_configured_secret's real contract

    fake_settings = SimpleNamespace(sarvam_api_key="env-key")
    monkeypatch.setattr(voice_registry_module, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(
        voice_registry_module, "get_configured_secret", fake_get_configured_secret
    )
    monkeypatch.setattr(voice_registry_module, "worker_session_factory", lambda: _NoOpSessionCM())

    provider = await voice_registry_module.get_tts_provider()

    assert isinstance(provider, SarvamTTS)
    assert provider.api_key == "env-key"
