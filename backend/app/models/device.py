"""Device model — a single authenticated client (a browser session or a
paired mobile device). There is no separate "user" concept: Cubicle is
single-user/self-hosted, so a bearer token minted by the setup password
(browser) and one minted by QR/token pairing (mobile) are both just rows
here, validated the same way by `app.api.deps.get_current_device`.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # Raw JSON-encoded PushSubscription object (endpoint + keys), as handed
    # to pywebpush verbatim — stored as text rather than parsed columns
    # since it's opaque to us either way. Null until the device opts in.
    push_subscription: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
