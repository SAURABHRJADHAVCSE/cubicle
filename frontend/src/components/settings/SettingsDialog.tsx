"use client";

import { Key, Palette, Smartphone } from "lucide-react";
import { useState } from "react";

import { AppearanceSettingsCard } from "@/components/settings/AppearanceSettingsCard";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { ClaudeAuthCard } from "@/components/settings/ClaudeAuthCard";
import { DevicesCard } from "@/components/settings/DevicesCard";
import { EngineCard } from "@/components/settings/EngineCard";
import { InstallAppCard } from "@/components/settings/InstallAppCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEngines } from "@/hooks/useEngines";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Settings, in-place — opens over the dashboard instead of navigating to
 * a separate /settings route, so the user never loses their place. */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [tab, setTab] = useState<"providers" | "appearance" | "devices">("providers");
  const { data: engines } = useEngines();
  const otherEngineKeys = Object.keys(engines ?? {}).filter((key) => key !== "claude_code");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex-col with two zones, not the default single scrolling
          box: the header/tabs live in a shrink-0 zone so they can't scroll
          away, and only the tab body scrolls, at a fixed height (not just a
          max-height) so switching tabs doesn't visibly resize the dialog.
          The close button is positioned by DialogContent itself relative to
          the whole (non-scrolling) popup, so it stays put automatically. */}
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton>
        <div className="shrink-0 p-4 pb-0">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-extrabold tracking-wide text-foreground uppercase">
              Settings & Configuration
            </DialogTitle>
            <DialogDescription>
              Manage AI engine connections and theme preferences.
            </DialogDescription>
          </DialogHeader>

          {/* grid grid-cols-3 (equal-width, always fits) instead of a flex
              row with overflow-x-auto — the flex version clipped the
              "Devices" tab off the edge on a phone with no visible scroll
              affordance, so it just looked cut off and undiscoverable
              rather than obviously scrollable. Labels drop to icon-only
              below sm for the same reason: three full labels don't fit a
              360px-ish phone screen even at equal width. */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-b border-border pb-2">
            <Button
              size="sm"
              variant={tab === "providers" ? "default" : "ghost"}
              className={`gap-1.5 rounded-lg px-2 text-xs font-bold sm:gap-2 sm:px-3 ${
                tab === "providers"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
              onClick={() => setTab("providers")}
              aria-label="Engine Providers"
            >
              <Key className="size-3.5 shrink-0" /> <span className="hidden truncate sm:inline">Engine Providers</span>
            </Button>
            <Button
              size="sm"
              variant={tab === "appearance" ? "default" : "ghost"}
              className={`gap-1.5 rounded-lg px-2 text-xs font-bold sm:gap-2 sm:px-3 ${
                tab === "appearance"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
              onClick={() => setTab("appearance")}
              aria-label="Appearance"
            >
              <Palette className="size-3.5 shrink-0" /> <span className="hidden truncate sm:inline">Appearance</span>
            </Button>
            <Button
              size="sm"
              variant={tab === "devices" ? "default" : "ghost"}
              className={`gap-1.5 rounded-lg px-2 text-xs font-bold sm:gap-2 sm:px-3 ${
                tab === "devices"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
              onClick={() => setTab("devices")}
              aria-label="Devices"
            >
              <Smartphone className="size-3.5 shrink-0" /> <span className="hidden truncate sm:inline">Devices</span>
            </Button>
          </div>
        </div>

        <div className="h-[min(440px,55dvh)] overflow-y-auto soft-scrollbar p-4 pt-3">
          {tab === "providers" && (
            <div className="flex flex-col gap-4">
              <ClaudeAuthCard />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {otherEngineKeys.map((key) => (
                  <EngineCard key={key} engineKey={key} />
                ))}
              </div>
            </div>
          )}

          {tab === "appearance" && <AppearanceSettingsCard />}
          {tab === "devices" && (
            <div className="flex flex-col gap-4">
              <InstallAppCard />
              <ChangePasswordCard />
              <DevicesCard />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
