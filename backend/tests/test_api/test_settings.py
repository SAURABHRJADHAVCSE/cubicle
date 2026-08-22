"""Tests for the Claude Code connection settings API, with the underlying
PTY/subprocess logic mocked out."""

import pytest
from httpx import AsyncClient

from app.api import settings as settings_module


async def test_status_reports_logged_in(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_status():
        return {"loggedIn": True, "authMethod": "oauth"}

    monkeypatch.setattr(settings_module, "aget_claude_auth_status", fake_status)

    resp = await client.get("/settings/claude-auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"logged_in": True, "auth_method": "oauth"}


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


async def test_complete_success(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_complete(code: str):
        assert code == "abc123"

    monkeypatch.setattr(settings_module, "asubmit_claude_auth_code", fake_complete)

    resp = await client.post("/settings/claude-auth/complete", json={"code": "abc123"})
    assert resp.status_code == 204


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
