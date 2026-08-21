"use client";

import { useState } from "react";

import { AddAgentDialog } from "@/components/agents/AddAgentDialog";
import { AgentCard } from "@/components/agents/AgentCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgents } from "@/hooks/useAgents";

export function AgentList() {
  const { data: agents, isLoading } = useAgents();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Agents {agents ? `(${agents.length})` : ""}
        </h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          Add agent
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 pr-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading agents…</p>
          )}
          {agents?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No agents yet. Add one to get started.
            </p>
          )}
          {agents?.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </ScrollArea>

      <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
