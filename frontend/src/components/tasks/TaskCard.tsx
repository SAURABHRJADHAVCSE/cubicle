"use client";

import { AlertCircle, CheckCircle2, Clock3, GitBranch, LoaderCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskResult } from "@/components/tasks/TaskResult";
import { useAgents } from "@/hooks/useAgents";
import { formatRelativeTime } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "Queued", className: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700" },
  assigned: { label: "Assigned", className: "bg-info/12 text-info border border-info/25" },
  in_progress: { label: "In progress", className: "bg-info/12 text-info border border-info/25" },
  review: { label: "In review", className: "bg-primary/12 text-primary border border-primary/25" },
  completed: { label: "Completed", className: "bg-success/12 text-success border border-success/25" },
  failed: { label: "Failed", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30" },
  routed: { label: "Routed", className: "bg-primary/12 text-primary border border-primary/25" },
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
    <article className="rounded-lg border border-slate-200 bg-white/70 p-3 shadow-sm transition-all hover:border-primary/40 hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:hover:bg-slate-900/90">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{task.title}</h4>
            {task.priority > 0 && (
              <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Priority
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {task.brief}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${status.className}`}>
          <StatusIcon status={task.status} />
          {status.label}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex -space-x-1.5">
            {assignedAgents.slice(0, 3).map((agent) => (
              <Avatar key={agent.id} className="size-4.5 ring-1 ring-white dark:ring-slate-800">
                <AvatarFallback
                  className="text-[7px] font-bold text-white"
                  style={{ backgroundColor: agent.accent_color }}
                >
                  {initials(agent.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
            {assignedAgents.map((agent) => agent.name).join(", ") || "Unassigned"}
          </span>
        </div>
        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
          {formatRelativeTime(task.created_at)}
        </span>
      </div>

      {task.status === "routed" && childTaskIds ? (
        <div className="mt-2 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] text-primary">
          Split into {childTaskIds.length} subtask{childTaskIds.length === 1 ? "" : "s"}.
        </div>
      ) : (
        <TaskResult task={task} />
      )}
    </article>
  );
}
