export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? API_URL;

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
    accent_color: "#06b6d4",
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
