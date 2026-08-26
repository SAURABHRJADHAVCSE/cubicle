"use client";

import { Activity, Building2, Settings, Sparkles } from "lucide-react";
import { useState } from "react";

import { AgentList } from "@/components/agents/AgentList";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { OfficeScene } from "@/components/office/OfficeScene";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { OnboardingDialog } from "@/components/setup/OnboardingDialog";
import { TaskHistory } from "@/components/tasks/TaskHistory";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";
import { useTasks } from "@/hooks/useTasks";
import { useUIStore } from "@/stores/uiStore";

export default function Home() {
  const { data: agents } = useAgents();
  const { data: tasks } = useTasks();
  const selectedAgentId = useUIStore((s) => s.selectedAgentId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const onlineAgents = agents?.filter((agent) => agent.status !== "offline").length ?? 0;
  const workingAgents =
    agents?.filter((agent) => ["working", "thinking"].includes(agent.status)).length ?? 0;
  const activeTasks =
    tasks?.filter((task) => ["assigned", "in_progress"].includes(task.status)).length ?? 0;

  return (
    <div className="app-bg flex h-screen w-screen flex-col overflow-hidden">
      <header className="glass-header z-20 flex h-[60px] shrink-0 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-[0_4px_16px_rgba(20,184,166,0.35)]">
            <Building2 className="size-4.5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Cubicle
              </h1>
              <span className="rounded-md bg-teal-500/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-teal-700 dark:text-teal-300 border border-teal-500/30">
                AI OFFICE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Autonomous Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-3 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 px-3.5 py-1.5 shadow-sm backdrop-blur-xl md:flex">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              {onlineAgents} online
            </span>
            <span className="h-3.5 w-px bg-slate-200 dark:bg-white/10" />
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Activity className="size-3.5 text-teal-600 dark:text-teal-400" />
              {workingAgents || activeTasks} active
            </span>
          </div>
          {agents?.length === 0 && (
            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              className="text-xs font-bold text-teal-600 hover:underline underline-offset-4 dark:text-teal-400"
            >
              Run setup
            </button>
          )}

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden p-3 gap-3">
        <div className="grid h-full min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_440px] gap-3">
          <OfficeScene className="h-full min-h-0 rounded-xl shadow-md border border-slate-200 dark:border-white/10" />

          <div className="glass-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-4 py-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-teal-600 dark:text-teal-400" />
                  <h2 className="font-heading text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Command center
                  </h2>
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Agents roster & real-time task feed
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[9px] font-bold tracking-widest text-emerald-700 dark:text-emerald-400">
                LIVE
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
              <aside className="h-[210px] shrink-0 overflow-hidden">
                <AgentList />
              </aside>
              <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
              <main className="min-h-0 flex-1 overflow-hidden">
                <TaskHistory />
              </main>
            </div>

            {selectedAgentId && <ChatPanel key={selectedAgentId} />}
          </div>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  );
}
