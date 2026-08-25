"use client";

import { Bot, ChevronRight, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useDeleteAgent } from "@/hooks/useAgents";
import { useTasks } from "@/hooks/useTasks";
import { useUIStore } from "@/stores/uiStore";
import type { Agent, AgentMood, AgentStatus } from "@/types/agent";

const STATUS_STYLES: Record<AgentStatus, { label: string; dot: string; surface: string }> = {
  idle: { label: "Available", dot: "bg-emerald-400", surface: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
  working: { label: "Working", dot: "bg-blue-400", surface: "bg-blue-500/15 text-blue-300 border border-blue-500/30" },
  thinking: { label: "Thinking", dot: "bg-purple-400", surface: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
  break: { label: "On break", dot: "bg-amber-400", surface: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  offline: { label: "Offline", dot: "bg-slate-400", surface: "bg-slate-800 text-slate-400 border border-slate-700" },
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

export function AgentCard({ agent }: { agent: Agent }) {
  const deleteAgent = useDeleteAgent();
  const selectAgent = useUIStore((s) => s.selectAgent);
  const { data: tasks } = useTasks();
  const status = STATUS_STYLES[agent.status];
  const currentTask = agent.current_task_id
    ? tasks?.find((task) => task.id === agent.current_task_id)
    : undefined;

  return (
    <div
      className="group relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 p-2 shadow-md transition-all hover:border-indigo-500/40 hover:bg-slate-900/80"
      onClick={() => selectAgent(agent.id)}
    >
      <span
        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
        style={{ backgroundColor: agent.accent_color }}
      />
      <Avatar className="size-9 ring-2 ring-white/10 shadow-sm ml-1">
        <AvatarFallback
          className="text-[11px] font-bold text-white"
          style={{
            background: `linear-gradient(145deg, ${agent.accent_color}, color-mix(in srgb, ${agent.accent_color} 68%, #0f172a))`,
          }}
        >
          {initials(agent.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-slate-100">{agent.name}</p>
          {MOOD_EMOJI[agent.mood] && <span aria-label={agent.mood}>{MOOD_EMOJI[agent.mood]}</span>}
          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${status.surface}`}>
            <span className={`size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-slate-400">
          <Bot className="size-3 shrink-0 text-slate-400" />
          <span className="truncate">{agent.role}</span>
          <span className="text-slate-600">•</span>
          <span className="truncate capitalize">{agent.engine_provider.replace("_", " ")}</span>
        </div>
        {currentTask && (
          <p className="mt-0.5 truncate text-[9.5px] font-medium text-indigo-400">
            Working on {currentTask.title}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute right-1 bottom-1 opacity-0 transition-opacity group-hover:opacity-100 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
        aria-label={`Delete ${agent.name}`}
        onClick={(event) => {
          event.stopPropagation();
          deleteAgent.mutate(agent.id);
        }}
        disabled={deleteAgent.isPending}
      >
        <Trash2 className="size-3" />
      </Button>
      <ChevronRight className="size-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
    </div>
  );
}
