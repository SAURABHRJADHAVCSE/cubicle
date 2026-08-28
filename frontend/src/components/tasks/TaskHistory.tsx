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
          <div className="flex size-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <ListTodo className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Task feed</h3>
            <p className="text-3xs text-slate-500 dark:text-slate-400">
              {activeCount > 0 ? `${activeCount} active` : `${tasks?.length ?? 0} total tasks`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-lg border-border bg-card px-2.5 text-xs text-foreground/80 shadow-sm hover:bg-muted"
          onClick={() => setNewTaskOpen(true)}
        >
          <Plus className="size-3.5" />
          New task
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 soft-scrollbar">
        <div className="flex flex-col gap-2.5 pr-2.5 pb-2">
          {isLoading && (
            <div className="h-28 animate-pulse rounded-lg bg-muted border border-border" />
          )}
          {sorted.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-center text-xs text-muted-foreground">
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
