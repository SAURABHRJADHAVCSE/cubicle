"use client";

import { Bot, ChevronRight, FolderOpen, Phone, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useDeleteAgent } from "@/hooks/useAgents";
import { useTasks } from "@/hooks/useTasks";
import { useUIStore } from "@/stores/uiStore";
import type { Agent, AgentMood, AgentStatus } from "@/types/agent";

const STATUS_STYLES: Record<AgentStatus, { label: string; dot: string; surface: string }> = {
  idle: { label: "Available", dot: "bg-success", surface: "bg-success/12 text-success border-success/40" },
  working: { label: "Working", dot: "bg-info", surface: "bg-info/12 text-info border-info/40" },
  thinking: { label: "Thinking", dot: "bg-primary", surface: "bg-primary/12 text-primary border-primary/40" },
  break: { label: "On break", dot: "bg-warning", surface: "bg-warning/12 text-warning border-warning/40" },
  offline: {
    label: "Offline",
    dot: "bg-slate-400",
    surface: "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-400/40 dark:border-slate-600/40",
  },
};

const MOOD_EMOJI: Record<AgentMood, string> = {
  neutral: "",
  happy: "🙂",
  stressed: "😬",
  excited: "🤩",
  bored: "😴",
};

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// A stable, deterministic "badge number" derived from the agent's own id —
// no schema change, just borrows the id's own entropy to look like a printed
// employee number on the card.
function badgeNumber(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export function AgentCard({ agent }: { agent: Agent }) {
  const deleteAgent = useDeleteAgent();
  const selectAgent = useUIStore((s) => s.selectAgent);
  const selectCallAgent = useUIStore((s) => s.selectCallAgent);
  const selectFilesAgent = useUIStore((s) => s.selectFilesAgent);
  const { data: tasks } = useTasks();
  const status = STATUS_STYLES[agent.status];
  const currentTask = agent.current_task_id
    ? tasks?.find((task) => task.id === agent.current_task_id)
    : undefined;

  return (
    <div
      className="group relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border border-border bg-card/70 p-2 shadow-sm transition-all hover:border-primary/40 hover:bg-card dark:hover:bg-card/90"
      onClick={() => selectAgent(agent.id)}
    >
      {/* Badge clip: the accent stripe. A punched-hole "grommet" dot sat here
          through three placement attempts and never actually read as
          attached to the stripe on screen — removed rather than a fourth
          guess; the badge number + stamp pill already carry the ID-badge
          concept on their own. */}
      <span
        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
        style={{ backgroundColor: agent.accent_color }}
      />
      <Avatar className="size-9 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm ml-1">
        <AvatarFallback
          className="text-2xs font-bold text-white"
          style={{
            background: `linear-gradient(145deg, ${agent.accent_color}, color-mix(in srgb, ${agent.accent_color} 68%, #0f172a))`,
          }}
        >
          {initials(agent.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-foreground">{agent.name}</p>
          {MOOD_EMOJI[agent.mood] && <span aria-label={agent.mood}>{MOOD_EMOJI[agent.mood]}</span>}
          <span className="text-4xs font-mono text-slate-400 dark:text-slate-500">#{badgeNumber(agent.id)}</span>
          <span className={`stamp-badge ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-4xs font-bold uppercase ${status.surface}`}>
            <span className={`size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-3xs text-slate-500 dark:text-slate-400">
          <Bot className="size-3 shrink-0 text-slate-400" />
          <span className="truncate">{agent.role}</span>
          <span className="text-slate-400 dark:text-slate-600">•</span>
          <span className="truncate capitalize">{agent.engine_provider.replace("_", " ")}</span>
        </div>
        {currentTask && (
          <p className="mt-0.5 truncate text-4xs font-medium text-primary">
            Working on {currentTask.title}
          </p>
        )}
      </div>

      {/* Always visible, not hover-gated: hover-to-reveal hid the only entry
          point to this agent's file browser behind a desktop-only :hover
          affordance nobody found — a touchscreen never fires :hover either,
          so it also needed a mobile escape hatch. Simpler and more
          discoverable to just always show the row. A normal flex child (not
          absolutely positioned) so it vertically centers with the chevron
          via the row's own items-center, instead of being pinned to the
          card's bottom edge independent of it. */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={`Browse ${agent.name}'s files`}
          onClick={(event) => {
            event.stopPropagation();
            selectFilesAgent(agent.id);
          }}
        >
          <FolderOpen className="size-3" />
        </Button>
        {agent.engine_type === "api" && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={`Call ${agent.name}`}
            onClick={(event) => {
              event.stopPropagation();
              selectCallAgent(agent.id);
            }}
          >
            <Phone className="size-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={`Delete ${agent.name}`}
          onClick={(event) => {
            event.stopPropagation();
            deleteAgent.mutate(agent.id);
          }}
          disabled={deleteAgent.isPending}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </div>
  );
}
