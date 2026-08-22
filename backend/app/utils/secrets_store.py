"""Read/write encrypted values in the `settings` table."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import SettingRecord
from app.utils.encryption import decrypt_value, encrypt_value

CLAUDE_OAUTH_TOKEN_KEY = "claude_code_oauth_token"


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
