"use client";

import { AlertTriangle, ChevronDown, FileWarning } from "lucide-react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useWorkspaceFile } from "@/hooks/useWorkspaceFile";
import { getTaskDisplaySummary, parseResultFileEntry } from "@/lib/task-output";
import type { Task } from "@/types/task";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);

/** Renders one task.result_files entry — an image/video inline (the only
 * kinds media generation ever produces, see backend media/base.py's
 * GeneratedMedia.kind), anything else as a plain path (no generic
 * download UI exists yet, not needed until a non-media file type shows up
 * here). */
function ResultFileEntry({ entry }: { entry: string }) {
  const parsed = parseResultFileEntry(entry);
  const { objectUrl, loading, error } = useWorkspaceFile(parsed?.agentId ?? "", parsed?.path ?? "");

  if (!parsed) return null;
  const ext = parsed.path.split(".").pop()?.toLowerCase() ?? "";

  if (loading) {
    return (
      <div className="flex h-32 w-full max-w-[220px] animate-pulse items-center justify-center rounded-lg bg-muted text-3xs text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (error || !objectUrl) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-3xs text-muted-foreground">
        <FileWarning className="size-3.5 shrink-0" />
        {error ?? "Couldn't load file"}
      </div>
    );
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- object URL, next/image can't optimize it
      <img
        src={objectUrl}
        alt={parsed.path}
        className="max-h-64 w-auto max-w-full rounded-lg border border-border object-contain"
      />
    );
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return (
      <video
        src={objectUrl}
        controls
        className="max-h-64 w-auto max-w-full rounded-lg border border-border"
      />
    );
  }
  return <p className="text-3xs text-muted-foreground break-all">{parsed.path}</p>;
}

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
      <div className="mt-2.5 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-2xs text-rose-300">
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
              <CollapsibleTrigger className="mt-1.5 flex items-center gap-1 font-medium text-rose-400 hover:text-rose-300 text-3xs">
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

  if (!summary && !task.result_files?.length) {
    return null;
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2 rounded-xl bg-muted/60 border border-border px-3 py-2.5">
      {summary && (
        <p className="line-clamp-4 whitespace-pre-wrap text-2xs leading-relaxed text-slate-700 dark:text-slate-300 break-words">{summary}</p>
      )}

      {task.result_files && task.result_files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {task.result_files.map((entry) => (
            <ResultFileEntry key={entry} entry={entry} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-4xs font-medium text-muted-foreground">
        {task.tokens_used > 0 && <span>{task.tokens_used} tokens</span>}
        {Number(task.cost_usd) > 0 && <span>${Number(task.cost_usd).toFixed(4)}</span>}
      </div>

      {task.result_raw && (
        <Collapsible open={showRaw} onOpenChange={setShowRaw}>
          <CollapsibleTrigger className="flex items-center gap-1 text-3xs text-muted-foreground hover:text-foreground">
            <ChevronDown className={`size-3 transition-transform ${showRaw ? "rotate-180" : ""}`} />
            {showRaw ? "Hide raw output" : "Show raw output"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-40 overflow-y-auto soft-scrollbar whitespace-pre-wrap break-words rounded-lg bg-slate-950/5 dark:bg-black/40 p-2 font-mono text-[9.5px] text-slate-700 dark:text-slate-300 border border-border">
              {task.result_raw}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
