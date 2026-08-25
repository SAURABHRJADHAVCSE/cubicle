"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getTaskDisplaySummary } from "@/lib/task-output";
import type { Task } from "@/types/task";

/**
 * Structured result card — never dumps raw terminal/JSON output by default
 * (cubicle_spec.md design decision #3: "No terminal exposure by default").
 * A "show raw output" drawer covers the developer case.
 */
export function TaskResult({ task }: { task: Task }) {
  const [showRaw, setShowRaw] = useState(false);
  const { summary } = getTaskDisplaySummary(task);

  if (task.status === "failed") {
    const authenticationFailure = /authentication|api.?key|unauthorized|401/i.test(summary ?? "");
    return (
      <div className="mt-2.5 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[11px] text-rose-300">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-rose-200">
            {authenticationFailure ? "API key required" : "Task failed"}
          </p>
          <p className="mt-0.5 leading-relaxed text-rose-300/90 break-words">
            {authenticationFailure
              ? "Connect this agent's API key in Settings, then try again."
              : (summary ?? "An error occurred while executing this task.")}
          </p>
          {task.result_raw && (
            <Collapsible open={showRaw} onOpenChange={setShowRaw}>
              <CollapsibleTrigger className="mt-1.5 flex items-center gap-1 font-medium text-rose-400 hover:text-rose-300 text-[10px]">
                <ChevronDown className={`size-3 transition-transform ${showRaw ? "rotate-180" : ""}`} />
                {showRaw ? "Hide error details" : "Technical error details"}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 max-h-32 overflow-y-auto soft-scrollbar whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2 font-mono text-[9.5px] text-rose-300 border border-rose-500/20">
                  {task.result_raw}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2 rounded-xl bg-slate-800/50 border border-white/5 px-3 py-2.5">
      <p className="line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300 break-words">{summary}</p>

      <div className="flex flex-wrap gap-3 text-[9px] font-medium text-slate-400">
        {task.tokens_used > 0 && <span>{task.tokens_used} tokens</span>}
        {Number(task.cost_usd) > 0 && <span>${Number(task.cost_usd).toFixed(4)}</span>}
      </div>

      {task.result_raw && (
        <Collapsible open={showRaw} onOpenChange={setShowRaw}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200">
            <ChevronDown className={`size-3 transition-transform ${showRaw ? "rotate-180" : ""}`} />
            {showRaw ? "Hide raw output" : "Show raw output"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-40 overflow-y-auto soft-scrollbar whitespace-pre-wrap break-words rounded-lg bg-black/40 p-2 font-mono text-[9.5px] text-slate-300 border border-white/10">
              {task.result_raw}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
