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
  { value: "groq", label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "zai", label: "GLM / Z.AI" },
  { value: "custom", label: "Custom / Bring your own API" },
];

// Anything outside this set, for an "api"-type agent, is a bring-your-own
// LiteLLM provider prefix the user typed directly (e.g. "gemini") — not a
// literal "custom" value. Mirrors backend/app/api/agents.py's own
// _BUILTIN_API_PROVIDERS, which must stay in sync with this list.
// Deliberately does NOT include groq/openrouter/zai — those are named
// presets for discoverability only, but still need a real model + API key
// exactly like any other custom provider (no free global fallback the way
// Anthropic has), so they must stay on the "custom" side of this set.
export const BUILTIN_API_PROVIDERS = new Set(["anthropic", "ollama"]);

// LiteLLM model-prefix examples per named preset (verified against
// LiteLLM's own provider docs, not guessed) — shown as the Model field's
// placeholder so picking "Groq" isn't left guessing at a bare model id vs.
// the vendor-prefixed form LiteLLM actually expects. GLM/Zhipu's LiteLLM
// prefix is "zai/", not "glm/" or "zhipu/" — confirmed live against
// docs.litellm.ai/docs/providers/zai; get this string wrong and the
// provider silently fails to route with an opaque error.
export const API_MODEL_PLACEHOLDERS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "anthropic/claude-3.5-sonnet",
  zai: "glm-4.7",
};
