"use client";

import { Activity, Boxes, Building2, Settings, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentList } from "@/components/agents/AgentList";
import { CallPanel } from "@/components/calls/CallPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { OfficeScene } from "@/components/office/OfficeScene";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { OnboardingDialog } from "@/components/setup/OnboardingDialog";
import { TaskHistory } from "@/components/tasks/TaskHistory";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";
import { useTasks } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

// The 3D office is a heavy always-rendering canvas — fine as a fixed side
// panel on desktop, but on a phone it doesn't need to run (or even mount)
// unless the user actually asks to see it. Below `md`, default to the
// agents/command-center view and let the 3D office be an opt-in tab instead
// of something always taking half the screen.
function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export default function Home() {
  const { data: agents } = useAgents();
  const { data: tasks } = useTasks();
  const selectedAgentId = useUIStore((s) => s.selectedAgentId);
  const activeCallAgentId = useUIStore((s) => s.activeCallAgentId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const isMobile = useIsMobileViewport();
  const [mobileTab, setMobileTab] = useState<"agents" | "office">("agents");
  const showOffice = !isMobile || mobileTab === "office";
  const showCommandCenter = !isMobile || mobileTab === "agents";
  const onlineAgents = agents?.filter((agent) => agent.status !== "offline").length ?? 0;
  const workingAgents =
    agents?.filter((agent) => ["working", "thinking"].includes(agent.status)).length ?? 0;
  const activeTasks =
    tasks?.filter((task) => ["assigned", "in_progress"].includes(task.status)).length ?? 0;

  return (
    <div className="app-bg flex h-screen w-screen flex-col overflow-hidden">
      <header className="glass-header z-20 flex h-[60px] shrink-0 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_6px_18px_color-mix(in_oklab,var(--primary)_28%,transparent)]">
            <Building2 className="size-4.5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Cubicle
              </h1>
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-4xs font-bold tracking-wider text-primary">
                AI OFFICE
              </span>
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 font-medium">Autonomous Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-3 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 px-3.5 py-1.5 shadow-sm backdrop-blur-xl md:flex">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="size-2 rounded-full bg-success shadow-[0_0_8px_color-mix(in_oklab,var(--success)_55%,transparent)]" />
              {onlineAgents} online
            </span>
            <span className="h-3.5 w-px bg-slate-200 dark:bg-white/10" />
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Activity className="size-3.5 text-primary" />
              {workingAgents || activeTasks} active
            </span>
          </div>
          {agents?.length === 0 && (
            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              className="text-xs font-bold text-primary hover:underline underline-offset-4"
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

      <div className="flex min-h-0 flex-1 overflow-y-auto md:overflow-hidden p-3 gap-3">
        <div className="grid flex-1 grid-cols-1 gap-3 md:h-full md:min-h-0 md:grid-cols-[1fr_440px]">
          {isMobile && (
            <div className="flex shrink-0 gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setMobileTab("agents")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition-colors",
                  mobileTab === "agents"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                <Users className="size-3.5" /> Agents
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("office")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition-colors",
                  mobileTab === "office"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                <Boxes className="size-3.5" /> 3D Office
              </button>
            </div>
          )}

          {showOffice && (
            <OfficeScene className="h-[55vh] min-h-[320px] rounded-xl border border-slate-200 shadow-md md:h-full md:min-h-0 dark:border-white/10" />
          )}

          {showCommandCenter && (
            <div className="glass-panel relative flex min-h-[420px] flex-col overflow-hidden rounded-xl md:h-full md:min-h-0">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-4 py-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <h2 className="font-heading text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Command center
                    </h2>
                  </div>
                  <p className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                    Agents roster & real-time task feed
                  </p>
                </div>
                <span className="rounded-full border border-success/25 bg-success/12 px-2.5 py-0.5 text-4xs font-bold tracking-widest text-success">
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
              <CallPanel key={activeCallAgentId} />
            </div>
          )}
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  );
}
