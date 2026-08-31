"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_PROVIDERS, BUILTIN_API_PROVIDERS, CLI_PROVIDERS, VERIFIED_CLI_PROVIDERS } from "@/lib/engineProviders";
import type { EngineType } from "@/types/agent";

interface EngineConfigFieldsProps {
  idPrefix: string;
  engineType: EngineType;
  provider: string;
  onProviderChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  command: string;
  onCommandChange: (value: string) => void;
  allowedTools: string;
  onAllowedToolsChange: (value: string) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  // Omitted (undefined) for a creation form — there's no existing agent to
  // have a key yet, so the field always reads "No key configured" there.
  hasEngineApiKey?: boolean;
}

/** Provider Select (incl. "Custom / Bring your own API") + model + the
 * CLI-only (allowed tools, command override) or API-only (key) fields that
 * follow from the engine type. Shared by AddAgentDialog.tsx's Engine step,
 * AgentManagePanel.tsx's edit form, and its inline "+ New Teammate" form —
 * pulled out so those three don't drift out of sync with three copies of
 * the same provider/model/key logic.
 */
export function EngineConfigFields({
  idPrefix,
  engineType,
  provider,
  onProviderChange,
  model,
  onModelChange,
  command,
  onCommandChange,
  allowedTools,
  onAllowedToolsChange,
  apiKey,
  onApiKeyChange,
  hasEngineApiKey,
}: EngineConfigFieldsProps) {
  const isCli = engineType === "cli";
  const isCustomApi = !isCli && !BUILTIN_API_PROVIDERS.has(provider);
  const providers = isCli ? CLI_PROVIDERS : API_PROVIDERS;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Engine Provider
        </Label>
        <Select
          value={isCustomApi ? "custom" : provider}
          onValueChange={(v) => {
            if (!v) return;
            // "custom" is a UI-only pseudo-selection — provider is cleared
            // so the text input below becomes the actual value the user
            // types the real provider prefix into.
            onProviderChange(v === "custom" ? "" : v);
          }}
          items={Object.fromEntries(providers.map((p) => [p.value, p.label]))}
        >
          <SelectTrigger className="w-full h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span>{p.label}</span>
                  {"verified" in p && Boolean((p as { verified?: boolean }).verified) && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-4xs font-bold text-emerald-500 border border-emerald-500/20">
                      VERIFIED
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustomApi && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-custom-provider`} className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Provider Prefix <span className="text-rose-500">*</span>
          </Label>
          <Input
            id={`${idPrefix}-custom-provider`}
            placeholder="gemini, openai, groq, mistral…"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-3xs text-slate-500 dark:text-slate-400">
            Any LiteLLM provider prefix — the model gets called as{" "}
            <code>{`${provider || "provider"}/${model || "model"}`}</code>.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-model`} className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Model {isCustomApi ? <span className="text-rose-500">*</span> : "(optional)"}
        </Label>
        <Input
          id={`${idPrefix}-model`}
          placeholder={
            isCustomApi
              ? "gemini-1.5-pro"
              : isCli
                ? "claude-3-7-sonnet / gpt-4o"
                : "claude-3-7-sonnet-20250219 / llama3.1:8b"
          }
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="font-mono text-sm"
        />
      </div>

      {isCli && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-tools`} className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Allowed Tools (comma-separated, optional)
            </Label>
            <Input
              id={`${idPrefix}-tools`}
              placeholder="Read, Write, Edit, Bash, Glob"
              value={allowedTools}
              onChange={(e) => onAllowedToolsChange(e.target.value)}
            />
          </div>
          {!VERIFIED_CLI_PROVIDERS.has(provider) && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-500">
              <Label htmlFor={`${idPrefix}-command`} className="text-xs font-bold">
                Custom CLI Command Override
              </Label>
              <Input
                id={`${idPrefix}-command`}
                placeholder={`${provider} exec {prompt}`}
                value={command}
                onChange={(e) => onCommandChange(e.target.value)}
                className="bg-card border-amber-500/40 text-xs"
              />
              <p className="text-2xs opacity-90">
                Use <code>{"{prompt}"}</code> as the substitution point for prompts.
              </p>
            </div>
          )}
        </>
      )}

      {!isCli && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-api-key`} className="text-xs font-bold text-slate-700 dark:text-slate-300">
            API Key {isCustomApi && hasEngineApiKey === undefined ? <span className="text-rose-500">*</span> : null}
          </Label>
          <Input
            id={`${idPrefix}-api-key`}
            type="password"
            placeholder={
              hasEngineApiKey === undefined
                ? "sk-…"
                : hasEngineApiKey
                  ? "•••••••• (leave blank to keep current)"
                  : "No key configured"
            }
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-3xs text-slate-500 dark:text-slate-400">
            Stored encrypted — never shown once saved.
            {hasEngineApiKey !== undefined && " Only entered here to rotate it."}
          </p>
        </div>
      )}
    </>
  );
}
