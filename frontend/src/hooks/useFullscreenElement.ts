"use client";

import { useEffect, useState } from "react";

/** The element currently in native Fullscreen API fullscreen, or null when
 * nothing is. The Fullscreen API only paints the fullscreened element and
 * its own DOM descendants — anything portaled to `document.body` (which
 * Base UI's Dialog/Select do by default) becomes invisible, though still
 * technically "open", the moment a different element (e.g. the Command
 * Center panel) goes fullscreen. Passed as the portal `container` by
 * ui/dialog.tsx and ui/select.tsx so their popups keep rendering inside
 * whatever's actually fullscreen instead of vanishing behind it.
 */
export function useFullscreenElement(): HTMLElement | null {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const update = () => setElement(document.fullscreenElement as HTMLElement | null);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  return element;
}
