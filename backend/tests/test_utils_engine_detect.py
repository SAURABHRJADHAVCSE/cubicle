"""Tests for app.utils.engine_detect."""

import pytest

from app.utils import engine_detect as engine_detect_module


async def test_check_ollama_true_on_200(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeResponse:
        status_code = 200

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        async def get(self, url, timeout):
            return _FakeResponse()

    monkeypatch.setattr(engine_detect_module.httpx, "AsyncClient", lambda: _FakeClient())

    assert await engine_detect_module.check_ollama("http://ollama:11434") is True


async def test_check_ollama_false_on_connection_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        async def get(self, url, timeout):
            raise httpx.ConnectError("refused")

    monkeypatch.setattr(engine_detect_module.httpx, "AsyncClient", lambda: _FakeClient())

    assert await engine_detect_module.check_ollama("http://ollama:11434") is False


async def test_detect_engines_reports_all_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(engine_detect_module.shutil, "which", lambda name: None)

    async def fake_check_ollama(base_url: str) -> bool:
        return False

    monkeypatch.setattr(engine_detect_module, "check_ollama", fake_check_ollama)

    result = await engine_detect_module.detect_engines()

    assert set(result.keys()) == {"claude_code", "ollama", "anthropic_api"}
