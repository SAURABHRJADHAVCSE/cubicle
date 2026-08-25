/** Single source of truth for engine display names + "how to enable this"
 * guidance — shared by Settings' engine cards and the onboarding wizard so
 * the two surfaces can never drift out of sync with each other or with
 * the 9 keys `GET /engines` (backend `app/utils/engine_detect.py`) returns.
 */
export interface EngineInfo {
  label: string;
  guidance: string;
}

export const ENGINE_INFO: Record<string, EngineInfo> = {
  claude_code: {
    label: "Claude Code CLI",
    guidance: "Connect your Claude subscription via the card above.",
  },
  opencode: {
    label: "OpenCode",
    guidance: "Install the OpenCode CLI and make sure it's on your PATH.",
  },
  codex: {
    label: "Codex",
    guidance: "Install the Codex CLI and make sure it's on your PATH.",
  },
  grok: {
    label: "Grok",
    guidance: "Install the Grok CLI and make sure it's on your PATH.",
  },
  gemini: {
    label: "Gemini",
    guidance: "Install the Gemini CLI and make sure it's on your PATH.",
  },
  antigravity: {
    label: "Antigravity",
    guidance: "Antigravity shares Gemini's CLI binary — install the Gemini CLI.",
  },
  qwen: {
    label: "Qwen",
    guidance: "Install the Qwen CLI and make sure it's on your PATH.",
  },
  ollama: {
    label: "Ollama (local)",
    guidance: "Run Ollama locally, or set OLLAMA_BASE_URL to point at your own instance.",
  },
  anthropic_api: {
    label: "Anthropic API",
    guidance: "Set ANTHROPIC_API_KEY in the backend's .env file.",
  },
};

export function engineInfo(key: string): EngineInfo {
  return ENGINE_INFO[key] ?? { label: key, guidance: "" };
}
