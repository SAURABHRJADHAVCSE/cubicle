"use client";

import Link from "next/link";
import { ArrowLeft, Cpu, Key, Palette } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ClaudeAuthCard } from "@/components/settings/ClaudeAuthCard";
import { AppearanceSettingsCard } from "@/components/settings/AppearanceSettingsCard";
import { EngineStatusList } from "@/components/setup/EngineStatusList";

export default function SettingsPage() {
  const [tab, setTab] = useState<"providers" | "appearance" | "diagnostics">("providers");

  return (
    <div className="app-bg min-h-screen w-full p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between border-b border-slate-300 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              render={<Link href="/" />}
              nativeButton={false}
              aria-label="Back to Office"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="font-heading text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                Settings & Configuration
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Manage AI engine keys, theme preferences, and office parameters
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-300 dark:border-white/10 pb-2">
          <Button
            size="sm"
            variant={tab === "providers" ? "default" : "ghost"}
            className={`gap-2 rounded-xl text-xs font-bold ${
              tab === "providers"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
            onClick={() => setTab("providers")}
          >
            <Key className="size-3.5" /> Engine Providers
          </Button>
          <Button
            size="sm"
            variant={tab === "appearance" ? "default" : "ghost"}
            className={`gap-2 rounded-xl text-xs font-bold ${
              tab === "appearance"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
            onClick={() => setTab("appearance")}
          >
            <Palette className="size-3.5" /> Theme & Office
          </Button>
          <Button
            size="sm"
            variant={tab === "diagnostics" ? "default" : "ghost"}
            className={`gap-2 rounded-xl text-xs font-bold ${
              tab === "diagnostics"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
            onClick={() => setTab("diagnostics")}
          >
            <Cpu className="size-3.5" /> Diagnostics
          </Button>
        </div>

        {/* Tab Content */}
        <div className="flex flex-col gap-5">
          {tab === "providers" && (
            <div className="flex flex-col gap-4">
              <ClaudeAuthCard />
            </div>
          )}

          {tab === "appearance" && (
            <div className="flex flex-col gap-4">
              <AppearanceSettingsCard />
            </div>
          )}

          {tab === "diagnostics" && (
            <div className="glass-panel brutal-card border-slate-300 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-5 rounded-2xl">
              <h2 className="font-heading text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-3">
                Engine Diagnostics Status
              </h2>
              <EngineStatusList />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
