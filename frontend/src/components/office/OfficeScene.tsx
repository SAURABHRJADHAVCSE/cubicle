"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";

import { SpeechBubbleOverlay } from "@/components/office/SpeechBubble";
import { useAgents } from "@/hooks/useAgents";
import { useSpeechBubbles } from "@/hooks/useSpeechBubbles";
import { cn } from "@/lib/utils";

const OfficeCanvas = dynamic(
  () => import("@/components/office/OfficeCanvas").then((m) => m.OfficeCanvas),
  { ssr: false },
);

interface OfficeSceneProps {
  className?: string;
}

/** Live 3D office: procedural voxel room + desks/avatars, with speech
 * bubbles floating on top. Sizing/visibility is entirely up to the caller
 * via `className` — this component just fills whatever box it's given.
 */
export function OfficeScene({ className }: OfficeSceneProps) {
  const bubbles = useSpeechBubbles();
  const { data: agents } = useAgents();
  const [resetKey, setResetKey] = useState(0);

  // A lost WebGL context (GPU driver TDR reset, seen in testing) isn't
  // always restored in place by the browser — remounting the whole canvas
  // gets a fresh context instead of leaving the panel permanently blank
  // until the user reloads the page.
  const handleContextLost = useCallback(() => {
    setTimeout(() => setResetKey((k) => k + 1), 500);
  }, []);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <OfficeCanvas key={resetKey} onContextLost={handleContextLost} />
      <SpeechBubbleOverlay bubbles={bubbles} />
      {agents?.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-background/85 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
            Add an agent to bring the office to life
          </p>
        </div>
      )}
    </div>
  );
}
