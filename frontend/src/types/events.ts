export interface AgentStatusEvent {
  agent_id: string;
  status: string;
  mood?: string;
  current_task_id: string | null;
}

export interface TaskStatusEvent {
  task_id: string;
  status: string;
}

export interface ServerToClientEvents {
  agent_status: (payload: AgentStatusEvent) => void;
  task_status: (payload: TaskStatusEvent) => void;
}
