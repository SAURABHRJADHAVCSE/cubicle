"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskResult } from "@/components/tasks/TaskResult";
import { useAgents } from "@/hooks/useAgents";
import type { Task, TaskStatus } from "@/types/task";

const STATUS_VARIANT: Record<TaskStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  assigned: "secondary",
  in_progress: "default",
  review: "secondary",
  completed: "secondary",
  failed: "destructive",
};

export function TaskCard({ task }: { task: Task }) {
  const { data: agents } = useAgents();
  const assignedNames = task.assigned_agents
    .map((id) => agents?.find((a) => a.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{task.title}</CardTitle>
          <Badge variant={STATUS_VARIANT[task.status]}>
            {task.status.replace("_", " ")}
          </Badge>
        </div>
        {assignedNames && (
          <p className="text-xs text-muted-foreground">Assigned to {assignedNames}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{task.brief}</p>
        <TaskResult task={task} />
      </CardContent>
    </Card>
  );
}
