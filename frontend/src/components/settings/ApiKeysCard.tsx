"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiKeysStatus, useUpdateApiKeys } from "@/hooks/useApiKeys";
import { ApiError } from "@/lib/api";

interface KeyFieldProps {
  id: string;
  label: string;
  configured: boolean;
  value: string;
  onChange: (value: string) => void;
}

function KeyField({ id, label, configured, value, onChange }: KeyFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs text-slate-600 dark:text-slate-300">
          {label}
        </Label>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-4xs font-bold ${
            configured
              ? "border-success/30 bg-success/15 text-success"
              : "border-border bg-secondary text-muted-foreground"
          }`}
        >
          {configured ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
          {configured ? "Configured" : "Not set"}
        </span>
      </div>
      <Input
        id={id}
        type="password"
        placeholder={configured ? "•••••••• (leave blank to keep current)" : "Not set"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-card rounded-lg font-mono text-sm"
      />
    </div>
  );
}

/** Lets the user set the global Anthropic/Sarvam API keys from Settings
 * instead of editing .env and restarting containers — same encrypted
 * storage (backend/app/utils/secrets_store.py) as the Claude Code OAuth
 * token ClaudeAuthCard.tsx already manages, just a plain paste-a-key flow
 * instead of an OAuth redirect. A DB-stored key here takes precedence
 * over the matching env var wherever it's consumed (see
 * engines/litellm_engine.py's _resolve_api_key, voice/registry.py's
 * _resolve_sarvam_key) — .env keeps working unchanged if left alone.
 */
export function ApiKeysCard() {
  const { data: status, isLoading } = useApiKeysStatus();
  const updateKeys = useUpdateApiKeys();

  const [anthropicKey, setAnthropicKey] = useState("");
  const [sarvamKey, setSarvamKey] = useState("");

  async function save() {
    // Only send fields the user actually typed into — omitted fields
    // leave whatever's already stored untouched (see ApiKeysUpdate's
    // contract), so leaving one box blank never clobbers the other key.
    const payload: Record<string, string> = {};
    if (anthropicKey.trim()) payload.anthropic_api_key = anthropicKey.trim();
    if (sarvamKey.trim()) payload.sarvam_api_key = sarvamKey.trim();
    if (Object.keys(payload).length === 0) {
      toast.error("Type a key into at least one field first");
      return;
    }
    try {
      await updateKeys.mutateAsync(payload);
      setAnthropicKey("");
      setSarvamKey("");
      toast.success("API keys updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update API keys");
    }
  }

  return (
    <div className="glass-panel rounded-lg border border-border bg-card/80 p-4 shadow-sm">
      <h3 className="font-heading text-sm font-bold tracking-wide text-foreground uppercase">
        API Keys
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Configure these from here instead of editing .env — no restart needed. Anthropic powers
        API-engine agents on the built-in Anthropic preset; Sarvam powers real speech-to-text and
        text-to-speech on voice calls.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <KeyField
          id="api-key-anthropic"
          label="Anthropic API Key"
          configured={Boolean(status?.has_anthropic_key)}
          value={anthropicKey}
          onChange={setAnthropicKey}
        />
        <KeyField
          id="api-key-sarvam"
          label="Sarvam API Key"
          configured={Boolean(status?.has_sarvam_key)}
          value={sarvamKey}
          onChange={setSarvamKey}
        />
        <Button
          size="sm"
          onClick={save}
          disabled={isLoading || updateKeys.isPending}
          className="w-fit rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          {updateKeys.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
