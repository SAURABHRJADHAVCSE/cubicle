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

export interface TaskDeletedEvent {
  task_id: string;
}

export interface CelebrationEvent {
  agent_id: string;
}

export interface SocialEvent {
  agent_id: string;
  event_type: string;
  dialogue: string;
  target_agent_id: string | null;
}

export interface ChatChunkEvent {
  agent_id: string;
  delta: string;
}

export interface ChatDoneEvent {
  agent_id: string;
  message: ConversationMessage;
}

export interface ChatToolCallStartedEvent {
  agent_id: string;
  task_id: string;
  target_agent_id: string;
  target_agent_name: string;
  brief: string;
}

export interface ChatToolCallFinishedEvent {
  agent_id: string;
  task_id: string;
  target_agent_id: string;
  target_agent_name: string;
  status: string;
}

export interface CallAnswerEvent {
  call_id: string;
  sdp: string;
}

export interface CallIceCandidateEvent {
  call_id: string;
  candidate: RTCIceCandidateInit;
}

export interface CallStatusEvent {
  call_id: string;
  message: string;
}

export interface CallTranscriptEvent {
  call_id: string;
  role: "user" | "agent";
  text: string;
}

export interface CallEndedEvent {
  call_id: string;
  reason: "hangup" | "error" | "disconnected";
}

/** Fired once a real delegation happens on a call AND the agent's spoken
 * acknowledgment has finished playing (see backend voice/pipeline.py's
 * _play_reply) — the frontend's cue to end the call and jump to the task
 * view, since the actual work is now tracked as a real Task there. */
export interface CallDelegatedEvent {
  call_id: string;
  task_id: string;
  target_agent_name: string;
}

export interface CallErrorEvent {
  call_id: string | null;
  message: string;
}

export interface CallOfferPayload {
  agent_id: string;
  sdp: string;
}

export interface CallIceCandidatePayload {
  call_id: string;
  candidate: RTCIceCandidateInit;
}

export interface CallHangupPayload {
  call_id: string;
}

export interface ClientToServerEvents {
  "call:offer": (payload: CallOfferPayload) => void;
  "call:ice_candidate": (payload: CallIceCandidatePayload) => void;
  "call:hangup": (payload: CallHangupPayload) => void;
}

export interface ServerToClientEvents {
  agent_status: (payload: AgentStatusEvent) => void;
  task_status: (payload: TaskStatusEvent) => void;
  task_deleted: (payload: TaskDeletedEvent) => void;
  chat_chunk: (payload: ChatChunkEvent) => void;
  chat_done: (payload: ChatDoneEvent) => void;
  chat_tool_call_started: (payload: ChatToolCallStartedEvent) => void;
  chat_tool_call_finished: (payload: ChatToolCallFinishedEvent) => void;
  celebration: (payload: CelebrationEvent) => void;
  social_event: (payload: SocialEvent) => void;
  "call:answer": (payload: CallAnswerEvent) => void;
  "call:ice_candidate": (payload: CallIceCandidateEvent) => void;
  "call:status": (payload: CallStatusEvent) => void;
  "call:transcript": (payload: CallTranscriptEvent) => void;
  "call:ended": (payload: CallEndedEvent) => void;
  "call:error": (payload: CallErrorEvent) => void;
  "call:delegated": (payload: CallDelegatedEvent) => void;
}
