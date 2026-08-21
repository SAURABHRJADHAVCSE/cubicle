import type { ConversationMessage } from "@/types/chat";

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

export interface ChatChunkEvent {
  agent_id: string;
  delta: string;
}

export interface ChatDoneEvent {
  agent_id: string;
  message: ConversationMessage;
}

export interface ServerToClientEvents {
  agent_status: (payload: AgentStatusEvent) => void;
  task_status: (payload: TaskStatusEvent) => void;
  chat_chunk: (payload: ChatChunkEvent) => void;
  chat_done: (payload: ChatDoneEvent) => void;
}
