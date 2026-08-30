"use client";

import { Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgents, useUpdateAgent } from "@/hooks/useAgents";
import { ApiError } from "@/lib/api";
import { API_PROVIDERS, BUILTIN_API_PROVIDERS, CLI_PROVIDERS, VERIFIED_CLI_PROVIDERS } from "@/lib/engineProviders";
import { useUIStore } from "@/stores/uiStore";

interface EditState {
  engineProvider: string;
  engineModel: string;
  engineCommand: string;
  allowedTools: string;
  engineApiKey: string;
}

/** Post-creation engine config editor — provider/model/key for API agents,
 * provider/model/command/allowed-tools for CLI agents. Mirrors
 * FilesPanel.tsx/TeamPanel.tsx's open/close-by-agent-id pattern exactly;
 * page.tsx mounts this with `key={activeConfigAgentId}`, so switching
 * agents fully remounts the component. engine_type itself isn't editable
 * here — switching CLI<->API is a structural change (different workspace/
 * soul semantics), out of scope for this panel.
 */
export function AgentConfigPanel() {
  const activeConfigAgentId = useUIStore((state) => state.activeConfigAgentId);
  const selectConfigAgent = useUIStore((state) => state.selectConfigAgent);
  const { data: agents } = useAgents();
  const agent = agents?.find((item) => item.id === activeConfigAgentId);
  const updateAgent = useUpdateAgent();

  const [edit, setEdit] = useState<EditState>({
    engineProvider: "",
    engineModel: "",
    engineCommand: "",
    allowedTools: "",
    engineApiKey: "",
  });

  // Seeds from the fetched agent the first time it arrives — kicking off
  // from fetched data, not deriving from props every render. The API key
  // field is deliberately never seeded (see the placeholder below) — the
  // real value is never sent to the client to seed it from.
  useEffect(() => {
    if (!agent) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdit({
      engineProvider: agent.engine_provider,
      engineModel: agent.engine_model ?? "",
      engineCommand: agent.engine_command ?? "",
      allowedTools: (agent.allowed_tools ?? []).join(", "),
      engineApiKey: "",
    });
  }, [agent]);

  if (!activeConfigAgentId) return null;

  function close() {
    selectConfigAgent(null);
  }

  const isCli = agent?.engine_type === "cli";
  const isCustomApi = !isCli && !BUILTIN_API_PROVIDERS.has(edit.engineProvider);
  const providers = isCli ? CLI_PROVIDERS : API_PROVIDERS;

  async function save() {
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
          // Omit entirely when blank so a blank field never clobbers an
          // already-stored key — only send it when the user actually typed
          // a new one. There's no "keep as-is" vs "clear" toggle here on
          // purpose: clearing a configured key is rare enough that routing
          // it through "type nothing" would be a footgun; a future
          // explicit "Remove key" action can add that if it's ever needed.
          ...(edit.engineApiKey.trim() ? { engine_api_key: edit.engineApiKey.trim() } : {}),
        },
      });
      setEdit((e) => ({ ...e, engineApiKey: "" }));
      toast.success("Agent config updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update agent config.");
    }
  }

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
            {agent?.name ?? "Agent"}&apos;s config
          </p>
          <p className="truncate font-mono text-3xs uppercase text-muted-foreground">
            {agent?.engine_type} engine
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={close}
          aria-label="Close config panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto soft-scrollbar p-4">
        {!agent ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Engine Provider
              </Label>
              <Select
                value={isCustomApi ? "custom" : edit.engineProvider}
                onValueChange={(v) => {
                  if (!v) return;
                  setEdit((e) => ({ ...e, engineProvider: v === "custom" ? "" : v }));
                }}
                items={Object.fromEntries(providers.map((p) => [p.value, p.label]))}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isCustomApi && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-custom-provider" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Provider Prefix <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="config-custom-provider"
                  placeholder="gemini, openai, groq, mistral…"
                  value={edit.engineProvider}
                  onChange={(e) => setEdit((s) => ({ ...s, engineProvider: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="config-model" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Model {isCustomApi ? <span className="text-rose-500">*</span> : "(optional)"}
              </Label>
              <Input
                id="config-model"
                value={edit.engineModel}
                onChange={(e) => setEdit((s) => ({ ...s, engineModel: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>

            {isCli && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="config-tools" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Allowed Tools (comma-separated)
                  </Label>
                  <Input
                    id="config-tools"
                    value={edit.allowedTools}
                    onChange={(e) => setEdit((s) => ({ ...s, allowedTools: e.target.value }))}
                  />
                </div>
                {!VERIFIED_CLI_PROVIDERS.has(edit.engineProvider) && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="config-command" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Custom CLI Command Override
                    </Label>
                    <Input
                      id="config-command"
                      placeholder={`${edit.engineProvider} exec {prompt}`}
                      value={edit.engineCommand}
                      onChange={(e) => setEdit((s) => ({ ...s, engineCommand: e.target.value }))}
                    />
                  </div>
                )}
              </>
            )}

            {!isCli && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="config-api-key" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  API Key
                </Label>
                <Input
                  id="config-api-key"
                  type="password"
                  placeholder={
                    agent.has_engine_api_key
                      ? "•••••••• (leave blank to keep current)"
                      : "No key configured"
                  }
                  value={edit.engineApiKey}
                  onChange={(e) => setEdit((s) => ({ ...s, engineApiKey: e.target.value }))}
                  className="font-mono text-sm"
                />
                <p className="text-3xs text-slate-500 dark:text-slate-400">
                  Stored encrypted — never shown once saved. Only entered here to rotate it.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {agent && (
        <div className="border-t border-border bg-muted/60 px-4 py-3">
          <Button
            className="w-full rounded-full text-2xs font-bold"
            onClick={save}
            disabled={updateAgent.isPending}
          >
            <Settings className="size-3.5 mr-1" />
            {updateAgent.isPending ? "Saving…" : "Save config"}
          </Button>
        </div>
      )}
    </div>
  );
}
