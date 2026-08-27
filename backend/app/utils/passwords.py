"""Instance setup-password hashing.

Uses stdlib `hashlib.scrypt` (slow/memory-hard, suitable for passwords)
rather than pulling in bcrypt/argon2 as a new dependency — scrypt has been
in the Python standard library since 3.6 and needs no extra package.
"""

import hashlib
import hmac
import secrets

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Return `salt_hex:hash_hex`, safe to store in the `settings` table."""
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
    )
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split(":", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    candidate = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
    )
    return hmac.compare_digest(candidate, expected)
