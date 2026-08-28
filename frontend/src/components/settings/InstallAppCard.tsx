"use client";

import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/** Surfaces an explicit "install" affordance instead of relying on the
 * browser's own (often hidden or easy-to-miss) install UI — Chrome/Edge/
 * Android can trigger the native prompt directly; iOS Safari has no such
 * API at all, so that path only ever gets instructions for its manual
 * Share-sheet flow. */
export function InstallAppCard() {
  const { installed, canPromptInstall, isIos, promptInstall } = usePwaInstall();

  if (installed) return null;
  if (!canPromptInstall && !isIos) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <Download className="size-3.5 text-primary" /> Install Cubicle
      </p>
      <p className="text-3xs leading-relaxed text-muted-foreground">
        Add it to your home screen for a full-screen app experience — no browser bar, opens
        instantly like any other app.
      </p>

      {canPromptInstall ? (
        <Button
          size="sm"
          onClick={promptInstall}
          className="w-fit rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Install app
        </Button>
      ) : (
        <p className="flex items-center gap-1 text-3xs text-muted-foreground">
          Tap <Share className="size-3 shrink-0" /> in Safari&apos;s toolbar, then{" "}
          <span className="font-semibold text-foreground">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}
