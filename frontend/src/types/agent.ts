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
}

export interface WorkspaceFileContent {
  path: string;
  size: number;
  readable: boolean;
  content?: string | null;
  reason?: string | null;
}
