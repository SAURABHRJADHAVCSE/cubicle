// Shared between AddAgentDialog.tsx (creation), AgentManagePanel.tsx
// (post-creation editing), and EngineConfigFields.tsx (the field set both
// of those render) so the surfaces can't drift out of sync.

export const CLI_PROVIDERS = [
  { value: "claude_code", label: "Claude Code", verified: true },
  { value: "opencode", label: "OpenCode", verified: true },
  { value: "codex", label: "Codex", verified: false },
  { value: "grok", label: "Grok", verified: false },
  { value: "gemini", label: "Gemini", verified: false },
  { value: "antigravity", label: "Antigravity", verified: false },
  { value: "qwen", label: "Qwen", verified: false },
];

export const VERIFIED_CLI_PROVIDERS = new Set(["claude_code", "opencode"]);

export const API_PROVIDERS = [
  { value: "anthropic", label: "Anthropic API" },
  { value: "ollama", label: "Ollama (Local)" },
  { value: "custom", label: "Custom / Bring your own API" },
];

// Anything outside this set, for an "api"-type agent, is a bring-your-own
// LiteLLM provider prefix the user typed directly (e.g. "gemini") — not a
// literal "custom" value. Mirrors backend/app/api/agents.py's own
// _BUILTIN_API_PROVIDERS, which must stay in sync with this list.
export const BUILTIN_API_PROVIDERS = new Set(["anthropic", "ollama"]);
