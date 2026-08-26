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
          <div className="flex size-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
            <UsersRound className="size-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200">Your agents</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {agents?.length ?? 0} teammate{agents?.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-7 rounded-lg bg-teal-600 px-2.5 text-xs text-white shadow-sm hover:bg-teal-500 dark:bg-teal-600 dark:hover:bg-teal-500"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-3.5" />
          Add agent
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 soft-scrollbar">
        <div className="flex flex-col gap-2 pr-2.5 pb-1">
          {isLoading && (
            <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5" />
          )}
          {agents?.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              No agents yet. Click &quot;Add agent&quot; to bring your office live.
            </div>
          )}
          {agents?.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </ScrollArea>

      <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
