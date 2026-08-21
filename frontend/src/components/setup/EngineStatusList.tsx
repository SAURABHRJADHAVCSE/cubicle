"use client";

import { Check, X } from "lucide-react";

import { useEngines } from "@/hooks/useEngines";

const LABELS: Record<string, string> = {
  claude_code: "Claude Code CLI",
  ollama: "Ollama (local)",
  anthropic_api: "Anthropic API",
};

export function EngineStatusList() {
  const { data: engines, isLoading } = useEngines();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Detecting engines…</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {Object.entries(engines ?? {}).map(([key, available]) => (
        <li key={key} className="flex items-center gap-2 text-sm">
          {available ? (
            <Check className="size-4 text-emerald-600" />
          ) : (
            <X className="size-4 text-muted-foreground" />
          )}
          <span className={available ? "" : "text-muted-foreground"}>
            {LABELS[key] ?? key}
          </span>
        </li>
      ))}
    </ul>
  );
}
