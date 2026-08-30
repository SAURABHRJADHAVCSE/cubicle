"use client";

import { Activity, Boxes, Building2, Maximize2, Minimize2, Settings, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AgentList } from "@/components/agents/AgentList";
import { CallPanel } from "@/components/calls/CallPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { FilesPanel } from "@/components/files/FilesPanel";
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
  const activeFilesAgentId = useUIStore((s) => s.activeFilesAgentId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const commandCenterRef = useRef<HTMLDivElement>(null);
  const [isCommandCenterFullscreen, setIsCommandCenterFullscreen] = useState(false);
  const isMobile = useIsMobileViewport();
  const [mobileTab, setMobileTab] = useState<"agents" | "office">("agents");
  const showOffice = !isMobile || mobileTab === "office";
  const showCommandCenter = !isMobile || mobileTab === "agents";
  const onlineAgents = agents?.filter((agent) => agent.status !== "offline").length ?? 0;
  const workingAgents =
    agents?.filter((agent) => ["working", "thinking"].includes(agent.status)).length ?? 0;
  const activeTasks =
    tasks?.filter((task) => ["assigned", "in_progress"].includes(task.status)).length ?? 0;

  // Mirrors OfficeScene.tsx's toggleFullscreen exactly — same real Fullscreen
  // API, same isFullscreen/ref shape — so both panels behave identically
  // instead of Command Center getting some lighter-weight "maximize" that
  // reads as a different feature.
  const toggleCommandCenterFullscreen = useCallback(() => {
    if (!commandCenterRef.current) return;
    if (!document.fullscreenElement) {
      commandCenterRef.current
        .requestFullscreen()
        .then(() => setIsCommandCenterFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsCommandCenterFullscreen(false)).catch(() => {});
    }
  }, []);

  return (
    <div className="app-bg flex h-screen w-screen flex-col overflow-hidden">
      <header className="glass-header z-20 flex h-[60px] shrink-0 items-center justify-between px-4 md:px-6">
        {/* Nameplate: the one place the header takes the "engraved office
            plaque" signature — a beveled mark plus a subtle emboss on the
            wordmark itself, everything else around it stays quiet. */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_6px_18px_color-mix(in_oklab,var(--primary)_28%,transparent),inset_0_1px_1px_color-mix(in_oklab,white_35%,transparent),inset_0_-1.5px_2px_color-mix(in_oklab,black_25%,transparent)]">
            <Building2 className="size-4.5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="font-heading text-base font-extrabold tracking-tight text-foreground"
                style={{ textShadow: "0 1px 0 color-mix(in oklab, white 60%, transparent)" }}
              >
                Cubicle
              </h1>
              <span className="stamp-badge rounded border-primary/30 bg-primary/10 px-2 py-0.5 text-4xs font-bold text-primary">
                AI OFFICE
              </span>
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400 font-medium">Autonomous Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-3 rounded-full border border-border bg-card/80 px-3.5 py-1.5 shadow-sm backdrop-blur-xl md:flex">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="size-2 rounded-full bg-success shadow-[0_0_8px_color-mix(in_oklab,var(--success)_55%,transparent)]" />
              {onlineAgents} online
            </span>
            <span className="h-3.5 w-px bg-border" />
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
            className="rounded-lg border border-border bg-card/80 text-foreground/80 hover:bg-muted"
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
            <div className="flex shrink-0 gap-1 rounded-lg border border-border bg-card/80 p-1 backdrop-blur-xl">
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
                  <Boxes className="size-3.5" /> Live office
              </button>
            </div>
          )}

          {showOffice && (
            <OfficeScene className="h-[55vh] min-h-[320px] rounded-xl border border-border shadow-md md:h-full md:min-h-0" />
          )}

          {showCommandCenter && (
            <div
              ref={commandCenterRef}
              className="glass-panel relative flex min-h-[420px] flex-col overflow-hidden rounded-xl md:h-full md:min-h-0"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
                      Command center
                    </h2>
                  </div>
                  <p className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                    Agents roster & real-time task feed
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full border border-success/25 bg-success/12 px-2.5 py-0.5 text-4xs font-bold tracking-widest text-success">
                    LIVE
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full border border-border bg-card text-muted-foreground hover:bg-muted"
                    onClick={toggleCommandCenterFullscreen}
                    aria-label="Toggle fullscreen"
                  >
                    {isCommandCenterFullscreen ? (
                      <Minimize2 className="size-3.5" />
                    ) : (
                      <Maximize2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
                <aside className="h-[210px] shrink-0 overflow-hidden">
                  <AgentList />
                </aside>
                <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
                <main className="min-h-0 flex-1 overflow-hidden">
                  <TaskHistory />
                </main>
              </div>

              {/* Prefixed, not bare ids: activeCallAgentId and
                  activeFilesAgentId are both null whenever neither panel is
                  open (the common case), and two siblings both keyed
                  literal `null` is a real React duplicate-key collision —
                  caught live via the dev overlay, not just reasoning. */}
              {selectedAgentId && <ChatPanel key={selectedAgentId} />}
              <CallPanel key={`call-${activeCallAgentId}`} />
              <FilesPanel key={`files-${activeFilesAgentId}`} />
            </div>
          )}
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  );
}
