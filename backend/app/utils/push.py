"""Web Push notifications to paired devices (task completed/failed, etc.).

Single-user app, so there's no per-device subscription targeting beyond
"every device that's opted in" — `notify_all_devices` fans a notification
out to every row in `devices` with a saved subscription, best-effort.
"""

import asyncio
import json

import structlog
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.device import Device

logger = structlog.get_logger()


def push_configured() -> bool:
    settings = get_settings()
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def _send_sync(subscription_json: str, title: str, body: str) -> None:
    settings = get_settings()
    webpush(
        subscription_info=json.loads(subscription_json),
        data=json.dumps({"title": title, "body": body}),
        vapid_private_key=settings.vapid_private_key,
        vapid_claims={"sub": settings.vapid_subject},
    )


async def notify_all_devices(session: AsyncSession, title: str, body: str) -> None:
    if not push_configured():
        return

    result = await session.execute(
        select(Device).where(Device.push_subscription.is_not(None))
    )
    devices = result.scalars().all()

    for device in devices:
        assert device.push_subscription is not None
        try:
            # pywebpush/`requests` are sync — offload so this doesn't block
            # the worker's event loop for each device in turn.
            await asyncio.to_thread(_send_sync, device.push_subscription, title, body)
        except WebPushException as exc:
            # A 404/410 means the subscription is dead (uninstalled, expired) —
            # clear it so future notifications don't keep retrying it forever.
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                device.push_subscription = None
                await session.commit()
            else:
                logger.warning("push_notification_failed", device_id=str(device.id), error=str(exc))
