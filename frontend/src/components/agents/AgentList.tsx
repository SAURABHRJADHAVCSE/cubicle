"use client";

import { Plus, UsersRound } from "lucide-react";
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
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <UsersRound className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200">Your agents</h3>
            <p className="text-3xs text-slate-500 dark:text-slate-400">
              {agents?.length ?? 0} teammate{agents?.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-7 rounded-lg bg-primary px-2.5 text-xs text-primary-foreground shadow-sm hover:bg-primary/90"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-3.5" />
          Add agent
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 soft-scrollbar">
        <div className="pr-2.5 pb-1">
          {isLoading && (
            <div className="h-16 animate-pulse rounded-lg bg-muted border border-border" />
          )}
          {agents?.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-center text-xs text-muted-foreground">
              No agents yet. Click &quot;Add agent&quot; to bring your office live.
            </div>
          )}
          {/* auto-fill + minmax: as many ~380px-wide cards per row as the
              panel's actual width allows — 1 column in the narrow split
              view (identical to the old stacked list), several side by
              side once there's room (fullscreen), with no separate
              breakpoint or fullscreen-specific logic needed. */}
          {agents && agents.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] items-start gap-2">
              {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
            </div>
          )}
        </div>
      </ScrollArea>

      <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
