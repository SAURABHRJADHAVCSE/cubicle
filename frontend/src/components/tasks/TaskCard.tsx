"use client";

import { AlertCircle, Ban, CheckCircle2, Clock3, GitBranch, LoaderCircle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskResult } from "@/components/tasks/TaskResult";
import { useAgents } from "@/hooks/useAgents";
import { useUpdateTask } from "@/hooks/useTasks";
import { formatRelativeTime } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "Queued", className: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600" },
  assigned: { label: "Assigned", className: "bg-info/12 text-info border-info/40" },
  in_progress: { label: "In progress", className: "bg-info/12 text-info border-info/40" },
  review: { label: "In review", className: "bg-primary/12 text-primary border-primary/40" },
  completed: { label: "Completed", className: "bg-success/12 text-success border-success/40" },
  failed: { label: "Failed", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40" },
  routed: { label: "Routed", className: "bg-primary/12 text-primary border-primary/40" },
  blocked: { label: "Blocked", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
};

const STATUS_OPTIONS = Object.fromEntries(
  Object.entries(STATUS_STYLES).map(([value, { label }]) => [value, label]),
) as Record<TaskStatus, string>;

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "completed") return <CheckCircle2 className="size-3" />;
  if (status === "failed") return <AlertCircle className="size-3" />;
  if (status === "routed") return <GitBranch className="size-3" />;
  if (status === "blocked") return <Ban className="size-3" />;
  if (["assigned", "in_progress"].includes(status)) {
    return <LoaderCircle className="size-3 animate-spin" />;
  }
  return <Clock3 className="size-3" />;
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// Matches AgentCard's badgeNumber() — same "printed reference code" idiom,
// so both card types read as one consistent paperwork system.
function refNumber(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

interface TaskCardProps {
  task: Task;
  /** Renders the status stamp as an editable control instead of a plain
   * pill — only TaskBoard passes this, so TaskHistory's flat list looks
   * exactly as it always has. */
  showStatusControl?: boolean;
}

export function TaskCard({ task, showStatusControl = false }: TaskCardProps) {
  const { data: agents } = useAgents();
  const updateTask = useUpdateTask();
  const status = STATUS_STYLES[task.status];
  const assignedAgents = task.assigned_agents
    .map((id) => agents?.find((agent) => agent.id === id))
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));
  const childTaskIds = Array.isArray(task.result_structured?.child_task_ids)
    ? (task.result_structured.child_task_ids as string[])
    : null;

  return (
    <article className="paper-grain relative rounded-lg border border-border bg-card/70 p-3 shadow-sm transition-all hover:border-primary/40 hover:bg-card dark:hover:bg-card/90">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="min-w-0 shrink truncate text-xs font-semibold text-foreground">{task.title}</h4>
            {task.priority > 0 && (
              <span className="stamp-badge rounded border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-4xs font-bold text-amber-700 uppercase dark:text-amber-300">
                Priority
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono text-4xs text-slate-400 dark:text-slate-500">
              REF #{refNumber(task.id)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-2xs leading-relaxed text-slate-500 dark:text-slate-400">
            {task.brief}
          </p>
        </div>
        {showStatusControl ? (
          <Select
            value={task.status}
            onValueChange={(value) =>
              value && updateTask.mutate({ id: task.id, payload: { status: value as TaskStatus } })
            }
            items={STATUS_OPTIONS}
          >
            <SelectTrigger
              className={`stamp-badge h-auto shrink-0 gap-1 rounded border px-2 py-0.5 text-4xs font-bold uppercase ${status.className}`}
            >
              <StatusIcon status={task.status} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className={`stamp-badge inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-4xs font-bold uppercase ${status.className}`}>
            <StatusIcon status={task.status} />
            {status.label}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2">
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
          <span className="truncate text-3xs text-slate-500 dark:text-slate-400">
            {assignedAgents.map((agent) => agent.name).join(", ") || "Unassigned"}
          </span>
        </div>
        <span className="shrink-0 text-3xs text-slate-400 dark:text-slate-500">
          {formatRelativeTime(task.created_at)}
        </span>
      </div>

      {task.status === "routed" && childTaskIds ? (
        <div className="mt-2 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-3xs text-primary">
          Split into {childTaskIds.length} subtask{childTaskIds.length === 1 ? "" : "s"}.
        </div>
      ) : (
        <TaskResult task={task} />
      )}
    </article>
  );
}
