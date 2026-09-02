"use client";

import { ArrowLeft, Check, ChevronRight, Plus, Settings, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EngineConfigFields } from "@/components/agents/EngineConfigFields";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAgentCollaborators,
  useAgents,
  useCreateAgent,
  useSetCollaborators,
  useUpdateAgent,
} from "@/hooks/useAgents";
import { ApiError } from "@/lib/api";
import { ROLE_PRESETS } from "@/lib/rolePresets";
import { useUIStore } from "@/stores/uiStore";
import type { EngineType } from "@/types/agent";

interface EditState {
  engineProvider: string;
  engineModel: string;
  engineCommand: string;
  allowedTools: string;
  engineApiKey: string;
  isMediaSpecialist: boolean;
  isWebSearch: boolean;
  tavilyApiKey: string;
}

const EMPTY_EDIT: EditState = {
  engineProvider: "",
  engineModel: "",
  engineCommand: "",
  allowedTools: "",
  engineApiKey: "",
  isMediaSpecialist: false,
  isWebSearch: false,
  tavilyApiKey: "",
};

interface NewAgentState {
  name: string;
  role: string;
  engineType: EngineType;
  engineProvider: string;
  engineModel: string;
  engineCommand: string;
  allowedTools: string;
  engineApiKey: string;
}

const EMPTY_NEW_AGENT: NewAgentState = {
  name: "",
  role: "",
  engineType: "api",
  engineProvider: "anthropic",
  engineModel: "",
  engineCommand: "",
  allowedTools: "",
  engineApiKey: "",
};

/** Manage one agent's own engine config and its teammate roster — and,
 * recursively, the same for any teammate you drill into. Replaces the
 * earlier separate TeamPanel.tsx (assign existing agents) and
 * AgentConfigPanel.tsx (edit engine settings): they were the same mental
 * action ("manage this agent") split across two buttons, which is exactly
 * the friction that motivated merging them, plus the ability to create a
 * brand-new teammate without leaving the panel at all.
 *
 * `stack` is local navigation state, not global — page.tsx mounts this
 * with `key={activeManageAgentId}`, so opening a *different* top-level
 * agent fully remounts and resets the stack; drilling into a teammate just
 * pushes onto it. engine_type itself isn't editable here — switching
 * CLI<->API is a structural change (different workspace/soul semantics),
 * out of scope for this panel, same as the panel it replaces.
 */
export function AgentManagePanel() {
  const activeManageAgentId = useUIStore((state) => state.activeManageAgentId);
  const selectManageAgent = useUIStore((state) => state.selectManageAgent);
  const { data: agents } = useAgents();
  const updateAgent = useUpdateAgent();
  const createAgent = useCreateAgent();
  const setCollaborators = useSetCollaborators();

  const [stack, setStack] = useState<string[]>(() =>
    activeManageAgentId ? [activeManageAgentId] : [],
  );
  const currentId = stack[stack.length - 1] ?? null;
  const agent = agents?.find((item) => item.id === currentId);

  const { data: teamData, isLoading: teamLoading } = useAgentCollaborators(currentId);

  const [edit, setEdit] = useState<EditState>(EMPTY_EDIT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentState>(EMPTY_NEW_AGENT);

  // Seeds from the fetched agent whenever the *viewed* agent changes
  // (drilling in/out re-triggers this, since `agent` becomes a different
  // object) — kicking off from fetched data, not deriving from props every
  // render. The API key field is deliberately never seeded — the real
  // value is never sent to the client to seed it from.
  useEffect(() => {
    if (!agent) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdit({
      engineProvider: agent.engine_provider,
      engineModel: agent.engine_model ?? "",
      engineCommand: agent.engine_command ?? "",
      allowedTools: (agent.allowed_tools ?? []).join(", "),
      engineApiKey: "",
      isMediaSpecialist: agent.is_media_specialist,
      isWebSearch: agent.has_web_search,
      tavilyApiKey: "",
    });
  }, [agent]);

  useEffect(() => {
    if (!teamData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set(teamData.collaborators.map((c) => c.id)));
  }, [teamData]);

  // A half-filled "new teammate" draft shouldn't survive navigating to a
  // different agent in the stack.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCreateForm(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewAgent(EMPTY_NEW_AGENT);
  }, [currentId]);

  if (!activeManageAgentId) return null;

  function close() {
    selectManageAgent(null);
  }

  function pushStack(id: string) {
    setStack((s) => [...s, id]);
  }

  function popStack() {
    setStack((s) => s.slice(0, -1));
  }

  function jumpTo(index: number) {
    setStack((s) => s.slice(0, index + 1));
  }

  const isCli = agent?.engine_type === "cli";

  async function saveConfig() {
    if (!agent) return;
    try {
      await updateAgent.mutateAsync({
        id: agent.id,
        payload: {
          engine_provider: edit.engineProvider,
          engine_model: edit.engineModel.trim() || null,
          engine_command: isCli ? edit.engineCommand.trim() || null : null,
          allowed_tools: isCli && edit.allowedTools.trim()
            ? edit.allowedTools.split(",").map((t) => t.trim()).filter(Boolean)
            : null,
          is_media_specialist: edit.isMediaSpecialist,
          has_web_search: edit.isWebSearch,
          // Omit entirely when blank so a blank field never clobbers an
          // already-stored key — only send it when the user actually typed
          // a new one.
          ...(edit.engineApiKey.trim() ? { engine_api_key: edit.engineApiKey.trim() } : {}),
          ...(edit.tavilyApiKey.trim() ? { tavily_api_key: edit.tavilyApiKey.trim() } : {}),
        },
      });
      setEdit((e) => ({ ...e, engineApiKey: "", tavilyApiKey: "" }));
      toast.success("Agent config updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update agent config.");
    }
  }

  function toggleTeammate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveTeam() {
    if (!currentId) return;
    try {
      await setCollaborators.mutateAsync({ id: currentId, collaboratorIds: [...selectedIds] });
      toast.success("Team updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update the team.");
    }
  }

  async function createTeammate() {
    if (!currentId) return;
    let created;
    try {
      created = await createAgent.mutateAsync({
        name: newAgent.name.trim(),
        role: newAgent.role.trim() || "AI Assistant",
        engine_type: newAgent.engineType,
        engine_provider: newAgent.engineProvider,
        engine_model: newAgent.engineModel.trim() || null,
        engine_command: newAgent.engineType === "cli" ? newAgent.engineCommand.trim() || null : null,
        engine_api_key: newAgent.engineType === "api" ? newAgent.engineApiKey.trim() || null : null,
        allowed_tools: newAgent.engineType === "cli" && newAgent.allowedTools.trim()
          ? newAgent.allowedTools.split(",").map((t) => t.trim()).filter(Boolean)
          : null,
        personality_traits: [],
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't create the new teammate.");
      return;
    }
    setShowCreateForm(false);
    setNewAgent(EMPTY_NEW_AGENT);
    // Links against the confirmed server roster (teamData), not the
    // possibly-edited-but-unsaved selectedIds — creating a teammate is an
    // immediate, committing action and shouldn't silently also persist
    // whatever unrelated checkbox toggles happen to be pending in this view.
    const existingIds = teamData?.collaborators.map((c) => c.id) ?? [];
    try {
      await setCollaborators.mutateAsync({
        id: currentId,
        collaboratorIds: [...existingIds, created.id],
      });
      toast.success(`${created.name} joined the team`);
    } catch {
      toast.error(
        `${created.name} was created but couldn't be added — add it manually from the list below.`,
      );
    }
  }

  const others = agents?.filter((item) => item.id !== currentId) ?? [];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background/95 shadow-2xl backdrop-blur-2xl md:absolute md:inset-0 md:border-l md:border-border text-foreground">
      <div className="flex items-center gap-2 border-b border-border bg-muted/90 px-4 py-3 backdrop-blur-xl">
        {stack.length > 1 && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={popStack}
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <Avatar className="size-8 shrink-0 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm" style={{ backgroundColor: agent?.accent_color }}>
          <AvatarFallback className="text-2xs font-bold text-white" style={{ backgroundColor: agent?.accent_color }}>
            {agent?.name.slice(0, 2).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1 font-heading text-xs">
            {stack.map((id, idx) => {
              const crumbAgent = agents?.find((item) => item.id === id);
              const isLast = idx === stack.length - 1;
              return (
                <span key={id} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
                  <button
                    type="button"
                    onClick={() => jumpTo(idx)}
                    disabled={isLast}
                    className={isLast ? "font-semibold text-foreground" : "text-muted-foreground hover:text-primary"}
                  >
                    {crumbAgent?.name ?? "…"}
                  </button>
                </span>
              );
            })}
          </div>
          <p className="truncate font-mono text-3xs uppercase text-muted-foreground">
            {agent?.engine_type} engine
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={close}
          aria-label="Close manage panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto soft-scrollbar p-4">
        {!agent ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <EngineConfigFields
                idPrefix="manage"
                engineType={agent.engine_type}
                provider={edit.engineProvider}
                onProviderChange={(v) => setEdit((s) => ({ ...s, engineProvider: v }))}
                model={edit.engineModel}
                onModelChange={(v) => setEdit((s) => ({ ...s, engineModel: v }))}
                command={edit.engineCommand}
                onCommandChange={(v) => setEdit((s) => ({ ...s, engineCommand: v }))}
                allowedTools={edit.allowedTools}
                onAllowedToolsChange={(v) => setEdit((s) => ({ ...s, allowedTools: v }))}
                apiKey={edit.engineApiKey}
                onApiKeyChange={(v) => setEdit((s) => ({ ...s, engineApiKey: v }))}
                hasEngineApiKey={agent.has_engine_api_key}
              />
              {!isCli && (
                <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 accent-primary"
                    checked={edit.isMediaSpecialist}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, isMediaSpecialist: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="font-semibold text-foreground">
                      Handles image/video generation
                    </span>
                    <span className="mt-0.5 block text-3xs text-muted-foreground">
                      Only an agent with this on gets generate_image/generate_video tools —
                      other agents will delegate media requests to it instead of trying (and
                      failing) to generate media themselves.
                    </span>
                  </span>
                </label>
              )}
              {!isCli && (
                <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 accent-primary"
                    checked={edit.isWebSearch}
                    onChange={(e) =>
                      setEdit((s) => ({ ...s, isWebSearch: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="font-semibold text-foreground">Can search the web</span>
                    <span className="mt-0.5 block text-3xs text-muted-foreground">
                      Only an agent with this on gets web_search/web_crawl tools — other agents
                      will say they can&apos;t look something up instead of guessing.
                    </span>
                  </span>
                </label>
              )}
              {!isCli && edit.isWebSearch && (
                <div className="flex flex-col gap-1.5 pl-1">
                  <label
                    htmlFor="manage-tavily-key"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Tavily API Key{" "}
                    <span className="font-normal text-slate-400 dark:text-slate-500">
                      (optional — leave blank to use the global key from Settings)
                    </span>
                  </label>
                  <Input
                    id="manage-tavily-key"
                    type="password"
                    placeholder={
                      agent.has_tavily_api_key
                        ? "•••••••• (leave blank to keep current)"
                        : "tvly-… (leave blank to use the global key)"
                    }
                    value={edit.tavilyApiKey}
                    onChange={(e) => setEdit((s) => ({ ...s, tavilyApiKey: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              )}
              <Button
                className="w-full rounded-full text-2xs font-bold"
                onClick={saveConfig}
                disabled={updateAgent.isPending}
              >
                <Settings className="size-3.5 mr-1" />
                {updateAgent.isPending ? "Saving…" : "Save config"}
              </Button>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {isCli ? (
              <div className="mx-auto max-w-[260px] text-center">
                <div className="mx-auto flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Users className="size-4" />
                </div>
                <p className="mt-3 text-xs font-semibold text-foreground">API engine required</p>
                <p className="mt-1 text-3xs text-muted-foreground">
                  Switch this agent to an API engine to give it teammates — CLI engines have no
                  structured tool-calling protocol to delegate through.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Users className="size-3.5 text-primary" /> Team
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-2xs font-bold text-primary hover:bg-primary/10"
                    onClick={() => setShowCreateForm((v) => !v)}
                  >
                    <Plus className="size-3.5 mr-1" /> New Teammate
                  </Button>
                </div>

                {showCreateForm && (
                  <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <Input
                      placeholder="Teammate name"
                      value={newAgent.name}
                      onChange={(e) => setNewAgent((n) => ({ ...n, name: e.target.value }))}
                      className="h-9 text-sm font-medium"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {ROLE_PRESETS.slice(0, 8).map((preset) => (
                        <button
                          key={preset.title}
                          type="button"
                          onClick={() => setNewAgent((n) => ({ ...n, role: preset.title }))}
                          className={`rounded-full border px-2 py-0.5 text-3xs font-medium transition-colors ${
                            newAgent.role === preset.title
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          {preset.title}
                        </button>
                      ))}
                    </div>
                    <Input
                      placeholder="Role / job title"
                      value={newAgent.role}
                      onChange={(e) => setNewAgent((n) => ({ ...n, role: e.target.value }))}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setNewAgent((n) => ({ ...n, engineType: "api", engineProvider: "anthropic" }))
                        }
                        className={`flex-1 rounded-lg border px-2.5 py-1.5 text-2xs font-bold transition-colors ${
                          newAgent.engineType === "api"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        API Model
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setNewAgent((n) => ({ ...n, engineType: "cli", engineProvider: "claude_code" }))
                        }
                        className={`flex-1 rounded-lg border px-2.5 py-1.5 text-2xs font-bold transition-colors ${
                          newAgent.engineType === "cli"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        CLI Agent
                      </button>
                    </div>
                    <EngineConfigFields
                      idPrefix="new-teammate"
                      engineType={newAgent.engineType}
                      provider={newAgent.engineProvider}
                      onProviderChange={(v) => setNewAgent((n) => ({ ...n, engineProvider: v }))}
                      model={newAgent.engineModel}
                      onModelChange={(v) => setNewAgent((n) => ({ ...n, engineModel: v }))}
                      command={newAgent.engineCommand}
                      onCommandChange={(v) => setNewAgent((n) => ({ ...n, engineCommand: v }))}
                      allowedTools={newAgent.allowedTools}
                      onAllowedToolsChange={(v) => setNewAgent((n) => ({ ...n, allowedTools: v }))}
                      apiKey={newAgent.engineApiKey}
                      onApiKeyChange={(v) => setNewAgent((n) => ({ ...n, engineApiKey: v }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-2xs"
                        onClick={() => setShowCreateForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-2xs font-bold"
                        onClick={createTeammate}
                        disabled={!newAgent.name.trim() || createAgent.isPending}
                      >
                        {createAgent.isPending ? "Creating…" : "Create & Add"}
                      </Button>
                    </div>
                  </div>
                )}

                {teamLoading ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
                ) : others.length === 0 ? (
                  <p className="text-3xs text-muted-foreground">
                    No other agents yet — use &ldquo;+ New Teammate&rdquo; above to create one.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {others.map((other) => {
                      const checked = selectedIds.has(other.id);
                      return (
                        <div
                          key={other.id}
                          className={`flex items-center gap-1 rounded-lg border transition-colors ${
                            checked ? "border-primary/40 bg-primary/5" : "border-transparent hover:border-border hover:bg-card"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleTeammate(other.id)}
                            className="flex flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs"
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
                          {checked && (
                            <button
                              type="button"
                              onClick={() => pushStack(other.id)}
                              aria-label={`Manage ${other.name}`}
                              title={`Manage ${other.name}`}
                              className="mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
                            >
                              <ChevronRight className="size-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {others.length > 0 && (
                  <Button
                    className="w-full rounded-full text-2xs font-bold"
                    onClick={saveTeam}
                    disabled={setCollaborators.isPending}
                  >
                    {setCollaborators.isPending ? "Saving…" : "Save team"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
