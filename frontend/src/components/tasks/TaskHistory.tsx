"use client";

import { ListTodo, Plus } from "lucide-react";
import { useState } from "react";

import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTasks } from "@/hooks/useTasks";

export function TaskHistory() {
  const { data: tasks, isLoading } = useTasks();
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const sorted = [...(tasks ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const activeCount = sorted.filter((task) =>
    ["assigned", "in_progress"].includes(task.status),
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5">
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
            <ListTodo className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200">Task feed</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {activeCount > 0 ? `${activeCount} active` : `${tasks?.length ?? 0} total tasks`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-lg border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 px-2.5 text-xs text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          onClick={() => setNewTaskOpen(true)}
        >
          <Plus className="size-3.5" />
          New task
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 soft-scrollbar">
        <div className="flex flex-col gap-2.5 pr-2.5 pb-2">
          {isLoading && (
            <div className="h-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5" />
          )}
          {sorted.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              No tasks yet. Create a new task to get started.
            </div>
          )}
          {sorted.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </ScrollArea>

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </div>
  );
}
