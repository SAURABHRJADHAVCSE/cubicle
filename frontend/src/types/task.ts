export type TaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "review"
  | "completed"
  | "failed"
  | "routed";

export interface Task {
  id: string;
  title: string;
  brief: string;
  status: TaskStatus;
  priority: number;

  assigned_agents: string[];
  orchestrator_agent_id: string | null;

  result_structured: Record<string, unknown> | null;
  result_raw: string | null;
  result_files: string[] | null;

  started_at: string | null;
  completed_at: string | null;
  tokens_used: number;
  cost_usd: string;

  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  brief: string;
  priority?: number;
  assigned_agents: string[];
  orchestrator_agent_id?: string | null;
}
