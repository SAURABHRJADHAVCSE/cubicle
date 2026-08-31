"""Tests for the Claude Code connection settings API, with the underlying
PTY/subprocess logic and encrypted storage mocked out."""

import pytest
from httpx import AsyncClient

from app.api import settings as settings_module


async def test_status_reports_not_connected_when_nothing_stored(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get(session, key):
        return None

    monkeypatch.setattr(settings_module, "get_encrypted_setting", fake_get)

    resp = await client.get("/settings/claude-auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"connected": False}


async def test_status_reports_connected_when_token_stored(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get(session, key):
        return "sk-ant-oat01-sometoken"

    monkeypatch.setattr(settings_module, "get_encrypted_setting", fake_get)

    resp = await client.get("/settings/claude-auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"connected": True}


async def test_start_returns_auth_url(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_start():
        return "https://claude.com/cai/oauth/authorize?code=true"

    monkeypatch.setattr(settings_module, "astart_claude_auth", fake_start)

    resp = await client.post("/settings/claude-auth/start")
    assert resp.status_code == 200
    assert resp.json() == {"auth_url": "https://claude.com/cai/oauth/authorize?code=true"}


async def test_start_conflict_returns_409(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_start():
        raise RuntimeError("A Claude Code connection attempt is already in progress")

    monkeypatch.setattr(settings_module, "astart_claude_auth", fake_start)

    resp = await client.post("/settings/claude-auth/start")
    assert resp.status_code == 409


async def test_complete_success_stores_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_complete(code: str) -> str:
        assert code == "abc123"
        return "sk-ant-oat01-realtoken"

    stored = {}

    async def fake_set(session, key, value):
        stored["key"] = key
        stored["value"] = value

    monkeypatch.setattr(settings_module, "asubmit_claude_auth_code", fake_complete)
    monkeypatch.setattr(settings_module, "set_encrypted_setting", fake_set)

    resp = await client.post("/settings/claude-auth/complete", json={"code": "abc123"})
    assert resp.status_code == 204
    assert stored == {"key": "claude_code_oauth_token", "value": "sk-ant-oat01-realtoken"}


async def test_complete_bad_code_returns_400(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_complete(code: str):
        raise RuntimeError("claude setup-token exited with code 1")

    monkeypatch.setattr(settings_module, "asubmit_claude_auth_code", fake_complete)

    resp = await client.post("/settings/claude-auth/complete", json={"code": "wrong"})
    assert resp.status_code == 400


async def test_cancel_calls_util(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    called = []

    async def fake_cancel():
        called.append(True)

    monkeypatch.setattr(settings_module, "acancel_claude_auth", fake_cancel)

    resp = await client.post("/settings/claude-auth/cancel")
    assert resp.status_code == 204
    assert called == [True]


# ---- /settings/api-keys — real encrypt/decrypt round trips, no mocking ----


async def test_api_keys_status_reports_unconfigured_after_clearing(client: AsyncClient) -> None:
    # Not asserting against a pristine empty table on GET alone — this
    # suite runs against the same real dev database the live app uses
    # (see conftest.py's own docstring), not a disposable one, so a real
    # key set through the actual UI (exactly what this feature is for)
    # would make a "nothing configured yet" assertion here flaky against
    # real usage. Clearing both within this test's own rolled-back
    # transaction first establishes a known baseline regardless of
    # whatever's really configured — rolled back at teardown, so it
    # doesn't touch the real stored keys at all.
    await client.put(
        "/settings/api-keys", json={"anthropic_api_key": "", "sarvam_api_key": ""}
    )

    resp = await client.get("/settings/api-keys")
    assert resp.status_code == 200
    assert resp.json() == {"has_anthropic_key": False, "has_sarvam_key": False}


async def test_api_keys_round_trip_and_never_echo_raw_value(client: AsyncClient) -> None:
    resp = await client.put(
        "/settings/api-keys",
        json={"anthropic_api_key": "sk-ant-real-key", "sarvam_api_key": "sk-sarvam-real-key"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"has_anthropic_key": True, "has_sarvam_key": True}
    assert "sk-ant-real-key" not in resp.text
    assert "sk-sarvam-real-key" not in resp.text

    status_resp = await client.get("/settings/api-keys")
    assert status_resp.json() == {"has_anthropic_key": True, "has_sarvam_key": True}


async def test_api_keys_omitted_field_left_untouched(client: AsyncClient) -> None:
    await client.put("/settings/api-keys", json={"anthropic_api_key": "sk-ant-real-key"})

    resp = await client.put("/settings/api-keys", json={"sarvam_api_key": "sk-sarvam-real-key"})

    assert resp.json() == {"has_anthropic_key": True, "has_sarvam_key": True}


async def test_api_keys_empty_string_clears(client: AsyncClient) -> None:
    await client.put("/settings/api-keys", json={"anthropic_api_key": "sk-ant-real-key"})

    resp = await client.put("/settings/api-keys", json={"anthropic_api_key": ""})

    assert resp.json()["has_anthropic_key"] is False


async def test_api_keys_actually_decrypt_correctly(
    client: AsyncClient, db_session
) -> None:
    """Not just "a value is stored" — the exact plaintext round-trips
    through real Fernet encryption, same mechanism engines/litellm_engine.py's
    _resolve_api_key will decrypt at call time."""
    from app.utils.secrets_store import ANTHROPIC_API_KEY_SETTING, get_encrypted_setting

    await client.put("/settings/api-keys", json={"anthropic_api_key": "sk-ant-exact-value"})

    decrypted = await get_encrypted_setting(db_session, ANTHROPIC_API_KEY_SETTING)
    assert decrypted == "sk-ant-exact-value"
