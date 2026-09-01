export type EngineType = "cli" | "api";

export type AgentStatus = "idle" | "working" | "thinking" | "break" | "offline";
export type AgentMood = "neutral" | "happy" | "stressed" | "excited" | "bored";

export interface Agent {
  id: string;
  name: string;
  role: string;

  engine_type: EngineType;
  engine_provider: string;
  engine_model: string | null;
  engine_command: string | null;
  working_directory: string | null;
  allowed_tools: string[] | null;
  // Never the raw key — just whether a bring-your-own API key is configured.
  has_engine_api_key: boolean;
  // Explicit opt-in for generate_image/generate_video tools — not derived
  // from engine_provider/key sharing (see backend media/registry.py).
  is_media_specialist: boolean;
  // Whether this agent is anyone's teammate (agent_collaborators) — drives
  // the "only chat with main agents" rule (see AgentCard.tsx).
  is_sub_agent: boolean;

  personality_traits: string[];
  personality_quirks: string[] | null;
  voice_language: string;
  voice_gender: string;
  voice_pace: string;

  character_id: string | null;
  accent_color: string;
  desk_position: number | null;

  status: AgentStatus;
  mood: AgentMood;
  current_task_id: string | null;

  created_at: string;
  updated_at: string;
}

export interface AgentCreate {
  name: string;
  role: string;
  engine_type: EngineType;
  engine_provider: string;
  engine_model?: string | null;
  engine_command?: string | null;
  working_directory?: string | null;
  allowed_tools?: string[] | null;
  // Plaintext here only — encrypted server-side, never returned. Required
  // for a custom (bring-your-own) API provider, i.e. engine_provider
  // outside {"anthropic", "ollama"}.
  engine_api_key?: string | null;
  is_media_specialist?: boolean;
  personality_traits: string[];
  personality_quirks?: string[] | null;
  voice_language?: string;
  voice_gender?: string;
  voice_pace?: string;
  character_id?: string | null;
  accent_color?: string;
  desk_position?: number | null;
}

export interface AgentUpdate {
  name?: string;
  role?: string;
  engine_type?: EngineType;
  engine_provider?: string;
  engine_model?: string | null;
  engine_command?: string | null;
  working_directory?: string | null;
  allowed_tools?: string[] | null;
  // Same contract as AgentCreate's field: omit to leave untouched, "" to
  // clear, a value to rotate. Never present in any response.
  engine_api_key?: string | null;
  is_media_specialist?: boolean;
  status?: AgentStatus;
  mood?: AgentMood;
  [key: string]: unknown;
}

export interface WorkspaceEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number | null;
}

export interface WorkspaceListing {
  path: string;
  entries: WorkspaceEntry[];
  host_path: string | null;
}

export interface WorkspaceFileContent {
  path: string;
  size: number;
  readable: boolean;
  content?: string | null;
  reason?: string | null;
}

export interface SoulUpdate {
  content: string;
}

export interface SoulRead {
  content: string;
}

export interface CollaboratorsUpdate {
  collaborator_ids: string[];
}

export interface CollaboratorsRead {
  collaborators: Agent[];
}
