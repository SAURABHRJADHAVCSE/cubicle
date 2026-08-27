"use client";

import { useEffect } from "react";

import { api } from "@/lib/api";
import { getAuthToken, onAuthTokenChange } from "@/lib/authToken";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission === "denied") return;

  const config = await api.devices.pushConfig();
  if (!config.configured || !config.vapid_public_key) return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
    });
  }

  await api.devices.savePushSubscription(subscription.toJSON());
}

/** Registers this device for Web Push (task-completed/failed notifications)
 * once it's authenticated. Silently no-ops wherever push isn't supported
 * (desktop browsers without permission granted, non-VAPID-configured
 * instances) or the user declines the permission prompt — this is a nice-
 * to-have, not something to nag about. */
export function useWebPush() {
  useEffect(() => {
    function trySubscribe(token: string | null) {
      if (token) subscribe().catch(() => {});
    }
    trySubscribe(getAuthToken());
    return onAuthTokenChange(trySubscribe);
  }, []);
}
