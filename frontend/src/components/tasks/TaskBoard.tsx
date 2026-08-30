"use client";

import { TaskCard } from "@/components/tasks/TaskCard";
import { useTasks } from "@/hooks/useTasks";
import type { Task, TaskStatus } from "@/types/task";

// One column per raw status value, in roughly the order a task actually
// moves through them. If this reads as too many/noisy columns once it's
// actually on screen, collapsing a few together (e.g. assigned+in_progress)
// is a pure render-grouping change here — no schema change needed.
const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Queued" },
  { status: "blocked", label: "Blocked" },
  { status: "assigned", label: "Assigned" },
  { status: "in_progress", label: "In progress" },
  { status: "routed", label: "Routed" },
  { status: "review", label: "In review" },
  { status: "completed", label: "Completed" },
  { status: "failed", label: "Failed" },
];

export function TaskBoard() {
  const { data: tasks, isLoading } = useTasks();

  const byStatus = new Map<TaskStatus, Task[]>();
  for (const task of tasks ?? []) {
    const bucket = byStatus.get(task.status) ?? [];
    bucket.push(task);
    byStatus.set(task.status, bucket);
  }

  const nonEmptyColumns = COLUMNS.filter((col) => (byStatus.get(col.status)?.length ?? 0) > 0);

  if (isLoading) {
    return <div className="h-28 animate-pulse rounded-lg bg-muted border border-border" />;
  }

  if (nonEmptyColumns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-center text-xs text-muted-foreground">
        No tasks yet. Create a new task to get started.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden soft-scrollbar">
      <div className="flex h-full gap-2.5 pb-2">
        {nonEmptyColumns.map((col) => {
          const columnTasks = byStatus.get(col.status) ?? [];
          return (
            <div key={col.status} className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto">
              <div className="flex items-center gap-1.5 px-0.5 shrink-0">
                <h4 className="text-3xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {col.label}
                </h4>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-4xs font-bold text-muted-foreground">
                  {columnTasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} showStatusControl />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
