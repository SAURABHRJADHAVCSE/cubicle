"""Tests for app.utils.secrets_store, against a real (transactional) DB session."""

from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils import encryption as encryption_module
from app.utils.secrets_store import delete_setting, get_encrypted_setting, set_encrypted_setting


@pytest.fixture(autouse=True)
def _fake_secret_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        encryption_module, "get_settings", lambda: SimpleNamespace(secret_key="test-secret-key")
    )


async def test_get_missing_setting_returns_none(db_session: AsyncSession) -> None:
    assert await get_encrypted_setting(db_session, "does-not-exist") is None


async def test_set_then_get_round_trips(db_session: AsyncSession) -> None:
    await set_encrypted_setting(db_session, "my_key", "my-secret-value")
    assert await get_encrypted_setting(db_session, "my_key") == "my-secret-value"


async def test_set_overwrites_existing_value(db_session: AsyncSession) -> None:
    await set_encrypted_setting(db_session, "my_key", "first-value")
    await set_encrypted_setting(db_session, "my_key", "second-value")
    assert await get_encrypted_setting(db_session, "my_key") == "second-value"


async def test_delete_setting_removes_it(db_session: AsyncSession) -> None:
    await set_encrypted_setting(db_session, "my_key", "value")
    await delete_setting(db_session, "my_key")
    assert await get_encrypted_setting(db_session, "my_key") is None


async def test_delete_missing_setting_is_a_noop(db_session: AsyncSession) -> None:
    await delete_setting(db_session, "does-not-exist")  # should not raise
