"use client";

import { AlertCircle, CheckCircle2, Clock3, GitBranch, LoaderCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskResult } from "@/components/tasks/TaskResult";
import { useAgents } from "@/hooks/useAgents";
import { formatRelativeTime } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "Queued", className: "bg-slate-800 text-slate-300 border border-slate-700" },
  assigned: { label: "Assigned", className: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  in_progress: { label: "In progress", className: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  review: { label: "In review", className: "bg-purple-500/20 text-purple-300 border border-purple-500/30" },
  completed: { label: "Completed", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
  failed: { label: "Failed", className: "bg-rose-500/20 text-rose-300 border border-rose-500/30" },
  routed: { label: "Routed", className: "bg-purple-500/20 text-purple-300 border border-purple-500/30" },
};

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "completed") return <CheckCircle2 className="size-3" />;
  if (status === "failed") return <AlertCircle className="size-3" />;
  if (status === "routed") return <GitBranch className="size-3" />;
  if (["assigned", "in_progress"].includes(status)) {
    return <LoaderCircle className="size-3 animate-spin" />;
  }
  return <Clock3 className="size-3" />;
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function TaskCard({ task }: { task: Task }) {
  const { data: agents } = useAgents();
  const status = STATUS_STYLES[task.status];
  const assignedAgents = task.assigned_agents
    .map((id) => agents?.find((agent) => agent.id === id))
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));
  const childTaskIds = Array.isArray(task.result_structured?.child_task_ids)
    ? (task.result_structured.child_task_ids as string[])
    : null;

  return (
    <article className="rounded-xl border border-white/10 bg-slate-900/60 p-3 shadow-md transition-all hover:border-indigo-500/40 hover:bg-slate-900/80">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-xs font-semibold text-slate-100">{task.title}</h4>
            {task.priority > 0 && (
              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                Priority
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
            {task.brief}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${status.className}`}>
          <StatusIcon status={task.status} />
          {status.label}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex -space-x-1.5">
            {assignedAgents.slice(0, 3).map((agent) => (
              <Avatar key={agent.id} className="size-4.5 ring-1 ring-slate-800">
                <AvatarFallback
                  className="text-[7px] font-bold text-white"
                  style={{ backgroundColor: agent.accent_color }}
                >
                  {initials(agent.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="truncate text-[10px] text-slate-400">
            {assignedAgents.map((agent) => agent.name).join(", ") || "Unassigned"}
          </span>
        </div>
        <span className="shrink-0 text-[10px] text-slate-500">
          {formatRelativeTime(task.created_at)}
        </span>
      </div>

      {task.status === "routed" && childTaskIds ? (
        <div className="mt-2 rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-1.5 text-[10px] text-purple-300">
          Split into {childTaskIds.length} subtask{childTaskIds.length === 1 ? "" : "s"}.
        </div>
      ) : (
        <TaskResult task={task} />
      )}
    </article>
  );
}
