// Shared between AddAgentDialog.tsx (creation) and AgentManagePanel.tsx
// (inline "+ New Teammate" creation) — quick-fill starting points only,
// the role field itself has always been fully freeform.
//
// Deliberately not coding-only: agents in Cubicle are general-purpose
// workers now (see the agents-as-tools delegation feature), not just dev
// tools — a team should plausibly include an image generator or a
// copywriter alongside a backend dev.
export const ROLE_PRESETS = [
  {
    title: "Full-Stack Developer",
    description: "Develops full-stack web applications, UI components, and backend APIs.",
  },
  {
    title: "Code Reviewer & Auditor",
    description: "Audits pull requests, reviews security, refactors code, and enforces standards.",
  },
  {
    title: "QA & Testing Specialist",
    description: "Writes unit tests, runs automated end-to-end testing, and reports bugs.",
  },
  {
    title: "DevOps Specialist",
    description: "Configures CI/CD pipelines, Docker containers, scripts, and deployments.",
  },
  {
    title: "AI & Data Engineer",
    description: "Processes data pipelines, analyzes telemetry, and tunes AI model prompts.",
  },
  {
    title: "Image & Visual Generator",
    description: "Generates illustrations, product shots, and social graphics from a brief.",
  },
  {
    title: "Copywriter & Content Strategist",
    description: "Drafts blog posts, landing pages, captions, and marketing copy.",
  },
  {
    title: "Social Media Manager",
    description: "Plans posts, writes captions, and packages content for social platforms.",
  },
  {
    title: "Customer Support Agent",
    description: "Answers customer questions, triages tickets, and drafts help responses.",
  },
  {
    title: "Market & Competitive Researcher",
    description: "Researches competitors, summarizes findings, and tracks industry trends.",
  },
  {
    title: "Sales & Outreach Specialist",
    description: "Drafts outreach emails, qualifies leads, and follows up on prospects.",
  },
  {
    title: "Personal Assistant",
    description: "Manages scheduling, reminders, research errands, and day-to-day admin.",
  },
  {
    title: "Translator & Localizer",
    description: "Translates and adapts content for a target language or region.",
  },
  {
    title: "Financial Analyst",
    description: "Reviews numbers, builds summaries, and flags anomalies in reports.",
  },
];
