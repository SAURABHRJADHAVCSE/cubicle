/** Resolved at call time, not import time — NEXT_PUBLIC_* env vars are
 * baked in at *build* time, which meant this only ever worked from
 * whatever single address (e.g. "localhost") the frontend image happened
 * to be built for. Reached over a LAN IP, a Tailscale hostname, or a
 * tunnel domain instead, every API/socket call silently tried to hit that
 * baked-in address from the browser's own machine and failed.
 *
 * Now: if NEXT_PUBLIC_API_URL/WS_URL were explicitly set at build time
 * (e.g. a Caddy deployment routing everything through one origin/port),
 * that still wins — it's an explicit choice. Otherwise, derive "whatever
 * host the browser actually loaded this page from, on port 8000" at
 * runtime, so the exact same build works unmodified from localhost, a LAN
 * IP, or a Tailscale MagicDNS name with zero rebuilding. */
function resolveUrl(explicit: string | undefined): string {
  if (explicit) return explicit;
  if (typeof window === "undefined") return "http://localhost:8000";
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

export function getApiUrl(): string {
  return resolveUrl(process.env.NEXT_PUBLIC_API_URL);
}

export function getWsUrl(): string {
  return resolveUrl(process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL);
}

export const PERSONALITY_TRAIT_CATEGORIES: Record<string, string[]> = {
  social: ["introvert", "extrovert", "ambivert"],
  work: ["workaholic", "balanced", "laid_back"],
  humor: ["dry_humor", "playful", "sarcastic", "wholesome"],
  habits: ["coffee_addict", "tea_person", "energy_drink", "health_freak"],
  quirks: ["perfectionist", "creative", "organized", "chaotic"],
  social_style: ["flirty", "professional", "mentor", "gossiper"],
};

export interface AgentTemplate {
  name: string;
  role: string;
  traits: string[];
  quirks: string[];
  accent_color: string;
  engine_type: "cli" | "api";
  engine_provider: string;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: "Priya",
    role: "Screener",
    traits: ["extrovert", "flirty", "coffee_addict", "organized"],
    quirks: [
      "Walks to nearest agent's desk after every task",
      "Sends 'you okay?' when office is quiet too long",
    ],
    accent_color: "#6366f1",
    engine_type: "api",
    engine_provider: "anthropic",
  },
  {
    name: "Arjun",
    role: "Researcher",
    traits: ["introvert", "workaholic", "dry_humor"],
    quirks: [
      "Works late even when all tasks are done",
      "Leaves sticky notes with random facts",
    ],
    accent_color: "#f97316",
    engine_type: "api",
    engine_provider: "anthropic",
  },
  {
    name: "Sam",
    role: "Writer",
    traits: ["ambivert", "laid_back", "creative", "playful"],
    quirks: [
      "Takes Pomodoro breaks every 25 minutes",
      "Sometimes wanders to the wrong desk",
    ],
    accent_color: "#8b5cf6",
    engine_type: "api",
    engine_provider: "anthropic",
  },
  {
    name: "Meera",
    role: "QA / Critic",
    traits: ["introvert", "perfectionist", "sarcastic", "tea_person"],
    quirks: [
      "Reviews work twice even when done",
      "Eye-roll when errors are found",
    ],
    accent_color: "#ec4899",
    engine_type: "api",
    engine_provider: "anthropic",
  },
  {
    name: "Ravi",
    role: "Dev",
    traits: ["introvert", "workaholic", "organized"],
    quirks: [
      "Terminal icon always visible on his desk",
      "Gets frustrated when tests fail",
    ],
    accent_color: "#22c55e",
    engine_type: "cli",
    engine_provider: "claude_code",
  },
];
