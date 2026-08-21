"use client";

import { ChevronDown } from "lucide-react";
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
    return (
      <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {summary ?? "Task failed."}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap text-sm">{summary}</p>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {task.tokens_used > 0 && <span>{task.tokens_used} tokens</span>}
        {Number(task.cost_usd) > 0 && <span>${Number(task.cost_usd).toFixed(4)}</span>}
      </div>

      {task.result_raw && (
        <Collapsible open={showRaw} onOpenChange={setShowRaw}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className={`size-3 transition-transform ${showRaw ? "rotate-180" : ""}`} />
            {showRaw ? "Hide raw output" : "Show raw output"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2 text-xs">
              {task.result_raw}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
