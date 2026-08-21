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
