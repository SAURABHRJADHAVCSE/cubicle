import type { Task } from "@/types/task";

export interface TaskDisplayOutput {
  /** Best-effort human-readable summary of what the agent produced. */
  summary: string | null;
  /** Whether `summary` was extracted from structured/raw JSON (vs plain text). */
  isExtracted: boolean;
}

/**
 * Cubicle never shows raw terminal output by default (cubicle_spec.md
 * design decision #3) — CLI engines return a JSON blob in `result_raw`
 * (e.g. Claude Code CLI's `{"result": "...", ...}` shape). This pulls out
 * a clean summary for the primary card, leaving the full payload behind a
 * "show raw output" drawer.
 */
export function getTaskDisplaySummary(task: Task): TaskDisplayOutput {
  if (task.result_structured && typeof task.result_structured === "object") {
    const structured = task.result_structured as Record<string, unknown>;
    if (typeof structured.output === "string") {
      return { summary: structured.output, isExtracted: true };
    }
  }

  if (task.result_raw) {
    try {
      const parsed = JSON.parse(task.result_raw) as Record<string, unknown>;
      if (typeof parsed.result === "string") {
        return { summary: parsed.result, isExtracted: true };
      }
    } catch {
      // Not JSON — the raw text itself is the summary.
      return { summary: task.result_raw, isExtracted: false };
    }
    return { summary: task.result_raw, isExtracted: false };
  }

  return { summary: null, isExtracted: false };
}

/** Splits a `task.result_files` entry ("{agent_id}:{relative_path}") back
 * into its parts — self-describing because `task.assigned_agents[0]` isn't
 * reliably the generating agent once delegation is involved, and the
 * frontend needs to know which agent's workspace to fetch from (see
 * backend/app/workers/task_worker.py's make_tool_executor). Returns null
 * for a malformed entry rather than throwing — one bad entry shouldn't
 * break rendering every other result file. */
export function parseResultFileEntry(entry: string): { agentId: string; path: string } | null {
  const separatorIndex = entry.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === entry.length - 1) return null;
  return {
    agentId: entry.slice(0, separatorIndex),
    path: entry.slice(separatorIndex + 1),
  };
}
