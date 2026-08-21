"""SettingRecord model — key/value app settings, with encrypted values at rest."""

from datetime import datetime

from sqlalchemy import LargeBinary, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SettingRecord(Base):
    """A single application setting (API keys, engine defaults, toggles, etc.).

    Named ``SettingRecord`` rather than ``Setting`` to avoid colliding with
    ``app.config.Settings`` (the pydantic-settings env-var configuration).
    """

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    value_plain: Mapped[str | None] = mapped_column(Text)

    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
