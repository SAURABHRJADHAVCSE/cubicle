"""Tests for app.utils.encryption."""

from types import SimpleNamespace

import pytest

from app.utils import encryption as encryption_module
from app.utils.encryption import EncryptionNotConfigured, decrypt_value, encrypt_value


@pytest.fixture(autouse=True)
def _fake_secret_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        encryption_module, "get_settings", lambda: SimpleNamespace(secret_key="test-secret-key")
    )


def test_encrypt_then_decrypt_round_trips() -> None:
    ciphertext = encrypt_value("sk-ant-oat01-super-secret")
    assert ciphertext != b"sk-ant-oat01-super-secret"
    assert decrypt_value(ciphertext) == "sk-ant-oat01-super-secret"


def test_encrypt_without_secret_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(encryption_module, "get_settings", lambda: SimpleNamespace(secret_key=None))

    with pytest.raises(EncryptionNotConfigured, match="SECRET_KEY"):
        encrypt_value("anything")


def test_decrypt_with_wrong_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    ciphertext = encrypt_value("a secret")

    monkeypatch.setattr(
        encryption_module, "get_settings", lambda: SimpleNamespace(secret_key="a-different-key")
    )

    with pytest.raises(EncryptionNotConfigured, match="Couldn't decrypt"):
        decrypt_value(ciphertext)
