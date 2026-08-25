"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskResult } from "@/components/tasks/TaskResult";
import { useAgents } from "@/hooks/useAgents";
import { formatRelativeTime } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/task";

// Same "what's the state" color language as AgentCard's STATUS_STYLES —
// pending/assigned are neutral-in-progress, completed is the same green as
// an idle agent, failed stays the existing destructive red, routed gets
// its own violet since it's a genuinely different kind of state (dispatched
// to subtasks, not executing itself).
const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  review: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-destructive/10 text-destructive",
  routed: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function TaskCard({ task }: { task: Task }) {
  const { data: agents } = useAgents();
  const assignedAgents = task.assigned_agents
    .map((id) => agents?.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const childTaskIds = Array.isArray(task.result_structured?.child_task_ids)
    ? (task.result_structured!.child_task_ids as string[])
    : null;

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5">
            {task.title}
            {task.priority > 0 && (
              <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400">
                priority {task.priority}
              </Badge>
            )}
          </CardTitle>
          <Badge className={STATUS_STYLES[task.status]}>
            {task.status.replace("_", " ")}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {assignedAgents.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {assignedAgents.map((agent) => (
                  <Avatar key={agent.id} size="sm" className="ring-2 ring-card">
                    <AvatarFallback style={{ backgroundColor: agent.accent_color, color: "white" }}>
                      {initials(agent.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {assignedAgents.map((a) => a.name).join(", ")}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{formatRelativeTime(task.created_at)}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{task.brief}</p>
        {task.status === "routed" && childTaskIds ? (
          <p className="text-sm text-muted-foreground">
            Routed → {childTaskIds.length} subtask{childTaskIds.length === 1 ? "" : "s"} dispatched
          </p>
        ) : (
          <TaskResult task={task} />
        )}
      </CardContent>
    </Card>
  );
}
