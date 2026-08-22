"""Symmetric encryption for settings values at rest (e.g. the Claude Code
OAuth token) — backs `settings.value_encrypted`.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class EncryptionNotConfigured(RuntimeError):
    """Raised when SECRET_KEY isn't set — encrypting with no real secret
    would be pointless, so this fails loudly instead of silently."""


def _fernet() -> Fernet:
    secret_key = get_settings().secret_key
    if not secret_key:
        raise EncryptionNotConfigured(
            "SECRET_KEY is not set. Add one to .env (e.g. "
            "`python -c \"import secrets; print(secrets.token_urlsafe(32))\"`) "
            "and restart the stack before storing secrets like the Claude "
            "Code OAuth token."
        )
    # Fernet requires a 32-byte urlsafe-base64 key specifically; derive one
    # deterministically from any-length secret so users can pick their own
    # SECRET_KEY string rather than needing to generate a Fernet key exactly.
    digest = hashlib.sha256(secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_value(plaintext: str) -> bytes:
    return _fernet().encrypt(plaintext.encode())


def decrypt_value(ciphertext: bytes) -> str:
    try:
        return _fernet().decrypt(ciphertext).decode()
    except InvalidToken as exc:
        raise EncryptionNotConfigured(
            "Couldn't decrypt this value — SECRET_KEY may have changed since it was stored."
        ) from exc
