"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { useEngines } from "@/hooks/useEngines";
import { engineInfo } from "@/lib/engineInfo";

interface EngineCardProps {
  engineKey: string;
}

/** Status + guidance card for one detected engine — no "connect" action,
 * since these are either local CLI binaries (can't be installed from a
 * web UI) or env-var-configured (Ollama/Anthropic). Claude Code is the
 * only engine with an actual in-app connect flow; see ClaudeAuthCard. */
export function EngineCard({ engineKey }: EngineCardProps) {
  const { data: engines, isLoading } = useEngines();
  const info = engineInfo(engineKey);
  const connected = engines?.[engineKey] ?? false;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900 dark:text-white">{info.label}</p>
        {!isLoading && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
              connected
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
            }`}
          >
            {connected ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {connected ? "Detected" : "Not detected"}
          </span>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{info.guidance}</p>
    </div>
  );
}
