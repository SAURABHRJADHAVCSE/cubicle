"use client";

import { SpeechBubbleOverlay } from "@/components/office/SpeechBubble";
import { SplineScene } from "@/components/office/SplineScene";
import { useSpeechBubbles } from "@/hooks/useSpeechBubbles";

/** Ambient office banner: Spline scene + live speech bubbles on top of it.
 * Hidden below `sm` — decoration isn't worth the render cost or the
 * vertical space on a phone screen.
 */
export function OfficeScene() {
  const bubbles = useSpeechBubbles();

  return (
    <div className="relative hidden h-48 shrink-0 px-6 pt-4 sm:block md:h-56">
      <SplineScene />
      <SpeechBubbleOverlay bubbles={bubbles} />
    </div>
  );
}
