"use client";

import { Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IdlePulse, ThinkingSpinner } from "@/components/common/Indicators";
import { useDeleteAgent } from "@/hooks/useAgents";
import { useTasks } from "@/hooks/useTasks";
import { useUIStore } from "@/stores/uiStore";
import type { Agent, AgentMood, AgentStatus } from "@/types/agent";

// Same palette as the 3D office's status ring (AgentAvatar.tsx) — the
// dashboard and the office scene should read as the same status at a
// glance, not two disconnected color systems.
const STATUS_STYLES: Record<AgentStatus, string> = {
  idle: "bg-green-500/15 text-green-700 dark:text-green-400",
  working: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  thinking: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  break: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  offline: "bg-muted text-muted-foreground",
};

const MOOD_EMOJI: Record<AgentMood, string> = {
  neutral: "",
  happy: "🙂",
  stressed: "😬",
  excited: "🤩",
  bored: "😴",
};

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function AgentCard({ agent }: { agent: Agent }) {
  const deleteAgent = useDeleteAgent();
  const selectAgent = useUIStore((s) => s.selectAgent);
  const { data: tasks } = useTasks();
  const currentTask = agent.current_task_id
    ? tasks?.find((t) => t.id === agent.current_task_id)
    : undefined;

  return (
    <Card
      size="sm"
      className="cursor-pointer border-l-2 transition-colors hover:bg-muted/50"
      style={{ borderLeftColor: agent.accent_color }}
      onClick={() => selectAgent(agent.id)}
    >
      <CardContent className="flex items-center gap-3">
        <Avatar style={{ backgroundColor: agent.accent_color }}>
          <AvatarFallback
            style={{ backgroundColor: agent.accent_color, color: "white" }}
          >
            {initials(agent.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium">{agent.name}</p>
            {MOOD_EMOJI[agent.mood] && <span aria-label={agent.mood}>{MOOD_EMOJI[agent.mood]}</span>}
            <Badge className={STATUS_STYLES[agent.status]}>{agent.status}</Badge>
            {agent.status === "working" && <ThinkingSpinner />}
            {agent.status === "idle" && <IdlePulse />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {agent.role} &middot; {agent.engine_provider}
          </p>
          {currentTask && (
            <p className="truncate text-xs text-muted-foreground italic">
              Working on: {currentTask.title}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${agent.name}`}
          onClick={(e) => {
            e.stopPropagation();
            deleteAgent.mutate(agent.id);
          }}
          disabled={deleteAgent.isPending}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
