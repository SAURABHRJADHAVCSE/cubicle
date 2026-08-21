"""Create/read round-trip tests for the SettingRecord model."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SettingRecord


async def test_setting_round_trip(db_session: AsyncSession) -> None:
    setting = SettingRecord(key="default_engine", value_plain="anthropic")
    db_session.add(setting)
    await db_session.flush()
    await db_session.refresh(setting)

    fetched = (
        await db_session.execute(select(SettingRecord).where(SettingRecord.key == "default_engine"))
    ).scalar_one()

    assert fetched.value_plain == "anthropic"
    assert fetched.value_encrypted is None
    assert fetched.updated_at is not None
