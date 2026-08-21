"use client";

import { useEffect } from "react";

/** Registers the hand-rolled service worker (public/sw.js) for offline
 * app-shell caching. Silently no-ops if the browser doesn't support it.
 */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline caching is a nice-to-have; a failed registration
        // shouldn't be surfaced to the user.
      });
    }
  }, []);

  return null;
}
