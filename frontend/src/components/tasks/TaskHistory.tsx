"use client";

import { useState } from "react";
import { ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useTasks } from "@/hooks/useTasks";

export function TaskHistory() {
  const { data: tasks, isLoading } = useTasks();
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const sorted = [...(tasks ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <ListTodo className="size-4" />
          Tasks {tasks ? `(${tasks.length})` : ""}
        </h2>
        <Button size="sm" onClick={() => setNewTaskOpen(true)}>
          + New task
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 pr-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading tasks…</p>}
          {sorted.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No tasks yet. Start one to see your agents work.
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
