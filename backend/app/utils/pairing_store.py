"""Short-lived, single-use device-pairing tokens.

Stored in Redis (already the Celery broker) rather than Postgres — TTL
expiry is a first-class Redis feature, and these tokens are meant to be
gone within minutes either way, so there's nothing worth persisting.
"""

import redis.asyncio as redis

from app.config import get_settings
from app.utils.tokens import generate_token

_PREFIX = "pairing_token:"
_TTL_SECONDS = 5 * 60

_client: redis.Redis | None = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


async def create_pairing_token() -> tuple[str, int]:
    """Mints a token; returns (token, ttl_seconds)."""
    token = generate_token()
    await _get_client().setex(f"{_PREFIX}{token}", _TTL_SECONDS, "1")
    return token, _TTL_SECONDS


async def consume_pairing_token(token: str) -> bool:
    """Atomically checks-and-deletes so a token can only ever be redeemed
    once. Returns whether it was valid."""
    deleted = await _get_client().delete(f"{_PREFIX}{token}")
    return deleted == 1
