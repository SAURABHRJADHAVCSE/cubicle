"use client";

import { LayoutGrid, List, ListTodo, Plus } from "lucide-react";
import { useState } from "react";

import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTasks } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

export function TaskHistory() {
  const { data: tasks, isLoading } = useTasks();
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const taskViewMode = useUIStore((s) => s.taskViewMode);
  const setTaskViewMode = useUIStore((s) => s.setTaskViewMode);

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
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setTaskViewMode("list")}
              aria-label="List view"
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors",
                taskViewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTaskViewMode("board")}
              aria-label="Board view"
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors",
                taskViewMode === "board"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
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
      </div>

      {taskViewMode === "board" ? (
        <TaskBoard />
      ) : (
        <ScrollArea className="min-h-0 flex-1 soft-scrollbar">
          <div className="pr-2.5 pb-2">
            {isLoading && (
              <div className="h-28 animate-pulse rounded-lg bg-muted border border-border" />
            )}
            {sorted.length === 0 && !isLoading && (
              <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-center text-xs text-muted-foreground">
                No tasks yet. Create a new task to get started.
              </div>
            )}
            {/* auto-fit (not auto-fill) — auto-fill reserves a column
                track for every width-380px slot the container could hold
                even when there aren't enough cards to fill them, leaving a
                large empty dead zone next to a handful of cards. auto-fit
                collapses those unused tracks and lets the real cards grow
                into the freed space instead, capped at 480px so a lone
                card in a wide panel doesn't stretch absurdly wide.
                items-start keeps each card at its own natural height
                instead of stretching short cards to match a taller
                neighbor in the same row. */}
            {sorted.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,480px))] items-start gap-2.5">
                {sorted.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </div>
  );
}
