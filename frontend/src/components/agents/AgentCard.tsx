"use client";

import { Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDeleteAgent } from "@/hooks/useAgents";
import type { Agent, AgentStatus } from "@/types/agent";

const STATUS_VARIANT: Record<AgentStatus, "default" | "secondary" | "outline"> = {
  working: "default",
  thinking: "default",
  idle: "secondary",
  break: "outline",
  offline: "outline",
};

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function AgentCard({ agent }: { agent: Agent }) {
  const deleteAgent = useDeleteAgent();

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <Avatar style={{ backgroundColor: agent.accent_color }}>
          <AvatarFallback
            style={{ backgroundColor: agent.accent_color, color: "white" }}
          >
            {initials(agent.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{agent.name}</p>
            <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {agent.role} &middot; {agent.engine_provider}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${agent.name}`}
          onClick={() => deleteAgent.mutate(agent.id)}
          disabled={deleteAgent.isPending}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
