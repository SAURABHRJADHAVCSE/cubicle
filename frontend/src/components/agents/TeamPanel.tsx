"use client";

import { Check, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAgentCollaborators, useAgents, useSetCollaborators } from "@/hooks/useAgents";
import { ApiError } from "@/lib/api";
import { useUIStore } from "@/stores/uiStore";

/** Lets the user assign an agent's explicit teammate roster — the agents it
 * may call as tools (see backend/app/utils/agent_tools.py). Mirrors
 * FilesPanel.tsx's open/close-by-agent-id pattern exactly: page.tsx mounts
 * this with `key={activeTeamAgentId}`, so switching agents fully remounts
 * the component and these useState initial values are already correct.
 */
export function TeamPanel() {
  const activeTeamAgentId = useUIStore((state) => state.activeTeamAgentId);
  const selectTeamAgent = useUIStore((state) => state.selectTeamAgent);
  const { data: agents } = useAgents();
  const agent = agents?.find((item) => item.id === activeTeamAgentId);
  const { data: current, isLoading } = useAgentCollaborators(activeTeamAgentId);
  const setCollaborators = useSetCollaborators();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Seeds from the fetched current roster the first time it arrives —
  // kicking off from fetched data, not deriving from props every render.
  useEffect(() => {
    if (!current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set(current.collaborators.map((c) => c.id)));
  }, [current]);

  if (!activeTeamAgentId) return null;

  function close() {
    selectTeamAgent(null);
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!activeTeamAgentId) return;
    try {
      await setCollaborators.mutateAsync({
        id: activeTeamAgentId,
        collaboratorIds: [...selectedIds],
      });
      toast.success("Team updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update the team.");
    }
  }

  const others = agents?.filter((item) => item.id !== activeTeamAgentId) ?? [];
  const isCliAgent = agent?.engine_type === "cli";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background/95 shadow-2xl backdrop-blur-2xl md:absolute md:inset-0 md:border-l md:border-border text-foreground">
      <div className="flex items-center gap-3 border-b border-border bg-muted/90 px-4 py-3 backdrop-blur-xl">
        <Avatar className="size-8 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm" style={{ backgroundColor: agent?.accent_color }}>
          <AvatarFallback className="text-2xs font-bold text-white" style={{ backgroundColor: agent?.accent_color }}>
            {agent?.name.slice(0, 2).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xs font-semibold text-foreground">
            {agent?.name ?? "Agent"}&apos;s team
          </p>
          <p className="truncate font-mono text-3xs text-muted-foreground">
            Teammates {agent?.name ?? "this agent"} can delegate to as tools
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={close}
          aria-label="Close team panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto soft-scrollbar p-3">
        {isCliAgent ? (
          <div className="mx-auto mt-10 max-w-[260px] text-center">
            <div className="mx-auto flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
            <p className="mt-3 text-xs font-semibold text-foreground">API engine required</p>
            <p className="mt-1 text-3xs text-muted-foreground">
              Switch this agent to an API engine to give it teammates — CLI engines have no
              structured tool-calling protocol to delegate through.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
        ) : others.length === 0 ? (
          <div className="mx-auto mt-10 max-w-[230px] text-center">
            <p className="text-xs font-semibold text-foreground">No other agents yet</p>
            <p className="mt-1 text-3xs text-muted-foreground">
              Create another agent first, then come back here to add it as a teammate.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {others.map((other) => {
              const checked = selectedIds.has(other.id);
              return (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => toggle(other.id)}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                    checked
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:border-border hover:bg-card"
                  }`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <Avatar className="size-6 shrink-0 ring-1 ring-slate-200 dark:ring-white/10">
                    <AvatarFallback className="text-3xs font-bold text-white" style={{ backgroundColor: other.accent_color }}>
                      {other.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{other.name}</p>
                    <p className="truncate text-3xs text-muted-foreground">{other.role}</p>
                  </div>
                  {other.engine_type === "cli" && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-4xs font-bold uppercase text-muted-foreground">
                      leaf only
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isCliAgent && others.length > 0 && (
        <div className="border-t border-border bg-muted/60 px-4 py-3">
          <Button
            className="w-full rounded-full text-2xs font-bold"
            onClick={save}
            disabled={setCollaborators.isPending}
          >
            {setCollaborators.isPending ? "Saving…" : "Save team"}
          </Button>
        </div>
      )}
    </div>
  );
}
