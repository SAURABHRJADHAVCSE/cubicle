"""Read/write encrypted values in the `settings` table."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import SettingRecord
from app.utils.encryption import decrypt_value, encrypt_value

CLAUDE_OAUTH_TOKEN_KEY = "claude_code_oauth_token"
ANTHROPIC_API_KEY_SETTING = "anthropic_api_key"
SARVAM_API_KEY_SETTING = "sarvam_api_key"
# Covers both image (Nano Banana) and video (Veo) generation — one Gemini
# API key does both, see media/registry.py. Fallback only — an agent's own
# Gemini key (Agent.engine_api_key_encrypted) is tried first.
GEMINI_MEDIA_API_KEY_SETTING = "gemini_media_api_key"


async def set_encrypted_setting(session: AsyncSession, key: str, value: str) -> None:
    record = await session.get(SettingRecord, key)
    encrypted = encrypt_value(value)
    if record is None:
        session.add(SettingRecord(key=key, value_encrypted=encrypted))
    else:
        record.value_encrypted = encrypted
    await session.commit()


async def get_encrypted_setting(session: AsyncSession, key: str) -> str | None:
    record = await session.get(SettingRecord, key)
    if record is None or record.value_encrypted is None:
        return None
    return decrypt_value(record.value_encrypted)


async def delete_setting(session: AsyncSession, key: str) -> None:
    record = await session.get(SettingRecord, key)
    if record is not None:
        await session.delete(record)
        await session.commit()


async def get_configured_secret(
    session: AsyncSession, key: str, env_fallback: str | None
) -> str | None:
    """A DB-stored setting (set from the UI) wins over an env-var value if
    both exist — lets a deployment start from .env and later move a secret
    into the UI without needing to also unset the env var. Shared by
    anything that wants "configurable from the UI, falls back to the
    existing env var" (engines/litellm_engine.py's Anthropic key,
    voice/registry.py's Sarvam key) instead of each writing this branch.
    """
    stored = await get_encrypted_setting(session, key)
    return stored if stored is not None else env_fallback


async def set_plain_setting(session: AsyncSession, key: str, value: str) -> None:
    """For values that are already safe to store as-is (e.g. a one-way
    password hash) — no point running them through Fernet too."""
    record = await session.get(SettingRecord, key)
    if record is None:
        session.add(SettingRecord(key=key, value_plain=value))
    else:
        record.value_plain = value
    await session.commit()


async def get_plain_setting(session: AsyncSession, key: str) -> str | None:
    record = await session.get(SettingRecord, key)
    return record.value_plain if record is not None else None
