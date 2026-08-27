"use client";

import { Key, Palette, Smartphone } from "lucide-react";
import { useState } from "react";

import { AppearanceSettingsCard } from "@/components/settings/AppearanceSettingsCard";
import { ClaudeAuthCard } from "@/components/settings/ClaudeAuthCard";
import { DevicesCard } from "@/components/settings/DevicesCard";
import { EngineCard } from "@/components/settings/EngineCard";
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
      <DialogContent className="max-h-[85vh] overflow-y-auto soft-scrollbar sm:max-w-2xl" showCloseButton>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-extrabold tracking-wide text-slate-900 uppercase dark:text-white">
            Settings & Configuration
          </DialogTitle>
          <DialogDescription>
            Manage AI engine connections and theme preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-white/10">
          <Button
            size="sm"
            variant={tab === "providers" ? "default" : "ghost"}
            className={`gap-2 rounded-lg text-xs font-bold ${
              tab === "providers"
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            onClick={() => setTab("providers")}
          >
            <Key className="size-3.5" /> Engine Providers
          </Button>
          <Button
            size="sm"
            variant={tab === "appearance" ? "default" : "ghost"}
            className={`gap-2 rounded-lg text-xs font-bold ${
              tab === "appearance"
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            onClick={() => setTab("appearance")}
          >
            <Palette className="size-3.5" /> Appearance
          </Button>
          <Button
            size="sm"
            variant={tab === "devices" ? "default" : "ghost"}
            className={`gap-2 rounded-lg text-xs font-bold ${
              tab === "devices"
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
            onClick={() => setTab("devices")}
          >
            <Smartphone className="size-3.5" /> Devices
          </Button>
        </div>

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
        {tab === "devices" && <DevicesCard />}
      </DialogContent>
    </Dialog>
  );
}
