"""Tests for the real (unmocked) auth gate: setup/login/pairing and the
`get_current_device` dependency protecting the rest of the API.

Deliberately builds its own client that leaves `get_current_device`
un-overridden (unlike the shared `client` fixture in conftest.py, which
treats every request as pre-authenticated so the rest of the suite can
focus on application behavior instead of re-proving auth every time).
"""

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import delete

from app.api.auth import INSTANCE_PASSWORD_KEY
from app.database import get_db
from app.main import app
from app.models.device import Device
from app.models.settings import SettingRecord


@pytest_asyncio.fixture
async def raw_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    # The shared dev DB may already have a real instance password set from
    # actual manual use (outside any test transaction) — these tests need
    # to start from a genuinely unset state regardless. Deleting it here
    # happens inside this test's own savepoint-wrapped session, so it rolls
    # back at teardown same as everything else (see conftest.py's docstring).
    existing = await db_session.get(SettingRecord, INSTANCE_PASSWORD_KEY)
    if existing is not None:
        await db_session.delete(existing)
    # Same story for any real paired devices from actual manual use —
    # device-count assertions below need a clean slate.
    await db_session.execute(delete(Device))
    await db_session.commit()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)


async def test_status_false_before_setup(raw_client: AsyncClient) -> None:
    resp = await raw_client.get("/auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"password_set": False}


async def test_setup_then_status_true(raw_client: AsyncClient) -> None:
    resp = await raw_client.post("/auth/setup", json={"password": "correct-horse", "device_name": "Test"})
    assert resp.status_code == 200
    assert "token" in resp.json()

    status_resp = await raw_client.get("/auth/status")
    assert status_resp.json() == {"password_set": True}


async def test_setup_rejects_short_password(raw_client: AsyncClient) -> None:
    resp = await raw_client.post("/auth/setup", json={"password": "short"})
    assert resp.status_code == 400


async def test_setup_twice_conflicts(raw_client: AsyncClient) -> None:
    await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    resp = await raw_client.post("/auth/setup", json={"password": "another-password"})
    assert resp.status_code == 409


async def test_login_before_setup_conflicts(raw_client: AsyncClient) -> None:
    resp = await raw_client.post("/auth/login", json={"password": "anything"})
    assert resp.status_code == 409


async def test_login_wrong_password_unauthorized(raw_client: AsyncClient) -> None:
    await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    resp = await raw_client.post("/auth/login", json={"password": "wrong-password"})
    assert resp.status_code == 401


async def test_login_correct_password_returns_token(raw_client: AsyncClient) -> None:
    await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    resp = await raw_client.post("/auth/login", json={"password": "correct-horse"})
    assert resp.status_code == 200
    assert "token" in resp.json()


async def test_protected_route_without_token_is_rejected(raw_client: AsyncClient) -> None:
    resp = await raw_client.get("/agents")
    assert resp.status_code == 401


async def test_protected_route_with_valid_token_succeeds(raw_client: AsyncClient) -> None:
    setup_resp = await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    token = setup_resp.json()["token"]

    resp = await raw_client.get("/agents", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


async def test_protected_route_with_bogus_token_is_rejected(raw_client: AsyncClient) -> None:
    resp = await raw_client.get("/agents", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


async def test_pairing_flow_end_to_end(raw_client: AsyncClient) -> None:
    setup_resp = await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    browser_token = setup_resp.json()["token"]

    pt_resp = await raw_client.post(
        "/devices/pairing-token", headers={"Authorization": f"Bearer {browser_token}"}
    )
    assert pt_resp.status_code == 200
    pairing_token = pt_resp.json()["token"]

    pair_resp = await raw_client.post(
        "/devices/pair", json={"pairing_token": pairing_token, "device_name": "My Phone"}
    )
    assert pair_resp.status_code == 200
    device_token = pair_resp.json()["token"]
    assert pair_resp.json()["device_name"] == "My Phone"

    # the new device token works against a protected route
    resp = await raw_client.get("/agents", headers={"Authorization": f"Bearer {device_token}"})
    assert resp.status_code == 200

    # single-use: the same pairing token can't be redeemed twice
    replay_resp = await raw_client.post(
        "/devices/pair", json={"pairing_token": pairing_token, "device_name": "Replay"}
    )
    assert replay_resp.status_code == 400


async def test_pairing_token_requires_auth(raw_client: AsyncClient) -> None:
    resp = await raw_client.post("/devices/pairing-token")
    assert resp.status_code == 401


async def test_pair_with_bogus_token_rejected(raw_client: AsyncClient) -> None:
    resp = await raw_client.post("/devices/pair", json={"pairing_token": "not-real", "device_name": "X"})
    assert resp.status_code == 400


async def test_list_and_revoke_devices(raw_client: AsyncClient) -> None:
    setup_resp = await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    browser_token = setup_resp.json()["token"]
    headers = {"Authorization": f"Bearer {browser_token}"}

    list_resp = await raw_client.get("/devices", headers=headers)
    assert list_resp.status_code == 200
    devices = list_resp.json()
    assert len(devices) == 1
    device_id = devices[0]["id"]

    revoke_resp = await raw_client.delete(f"/devices/{device_id}", headers=headers)
    assert revoke_resp.status_code == 204

    # the revoked token no longer works anywhere, including for itself
    resp = await raw_client.get("/devices", headers=headers)
    assert resp.status_code == 401


async def test_change_password_requires_auth(raw_client: AsyncClient) -> None:
    resp = await raw_client.post(
        "/auth/change-password", json={"current_password": "correct-horse", "new_password": "new-password"}
    )
    assert resp.status_code == 401


async def test_change_password_wrong_current_password_rejected(raw_client: AsyncClient) -> None:
    setup_resp = await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    headers = {"Authorization": f"Bearer {setup_resp.json()['token']}"}

    resp = await raw_client.post(
        "/auth/change-password",
        json={"current_password": "wrong-password", "new_password": "new-password"},
        headers=headers,
    )
    assert resp.status_code == 400


async def test_change_password_rejects_short_new_password(raw_client: AsyncClient) -> None:
    setup_resp = await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    headers = {"Authorization": f"Bearer {setup_resp.json()['token']}"}

    resp = await raw_client.post(
        "/auth/change-password",
        json={"current_password": "correct-horse", "new_password": "short"},
        headers=headers,
    )
    assert resp.status_code == 400


async def test_change_password_success_and_old_password_stops_working(raw_client: AsyncClient) -> None:
    setup_resp = await raw_client.post("/auth/setup", json={"password": "correct-horse"})
    browser_token = setup_resp.json()["token"]
    headers = {"Authorization": f"Bearer {browser_token}"}

    resp = await raw_client.post(
        "/auth/change-password",
        json={"current_password": "correct-horse", "new_password": "new-password"},
        headers=headers,
    )
    assert resp.status_code == 204

    # the existing device token still works — changing the password doesn't
    # revoke already-paired devices
    still_works = await raw_client.get("/devices", headers=headers)
    assert still_works.status_code == 200

    # but logging in fresh needs the new password now
    old_login = await raw_client.post("/auth/login", json={"password": "correct-horse"})
    assert old_login.status_code == 401
    new_login = await raw_client.post("/auth/login", json={"password": "new-password"})
    assert new_login.status_code == 200
