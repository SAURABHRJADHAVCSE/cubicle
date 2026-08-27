"""Opaque bearer-token generation and storage-hashing.

Unlike passwords, these tokens are already high-entropy random strings
(`secrets.token_urlsafe`), so a plain fast hash is sufficient for at-rest
storage — no salted/slow KDF needed the way `passwords.py` needs one.
"""

import hashlib
import secrets

TOKEN_BYTES = 32


def generate_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
