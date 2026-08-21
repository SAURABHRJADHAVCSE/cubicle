export interface ConversationMessage {
  id: string;
  agent_id: string;
  role: "user" | "agent";
  content: string;
  message_type: string;
  created_at: string;
}

export interface ChatRequest {
  message: string;
}
