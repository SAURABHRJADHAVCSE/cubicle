"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookHeart,
  Check,
  CheckCircle2,
  Cpu,
  FolderGit2,
  Sparkles,
  Terminal,
  User,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ClaudeAuthCard } from "@/components/settings/ClaudeAuthCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAgent } from "@/hooks/useAgents";
import { api } from "@/lib/api";
import {
  API_PROVIDERS,
  BUILTIN_API_PROVIDERS,
  CLI_PROVIDERS,
  VERIFIED_CLI_PROVIDERS,
} from "@/lib/engineProviders";
import type { EngineType } from "@/types/agent";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  accentColor: string;
  engineType: EngineType;
  engineProvider: string;
  engineModel: string;
  engineCommand: string;
  engineApiKey: string;
  allowedTools: string;
  workingDirectory: string;
  role: string;
  soul: string;
}

const DEFAULT_STATE: FormState = {
  name: "",
  accentColor: "#6366f1",
  engineType: "api",
  engineProvider: "anthropic",
  engineModel: "",
  engineCommand: "",
  engineApiKey: "",
  allowedTools: "",
  workingDirectory: "",
  role: "",
  soul: "",
};

// A client-side starting point — doesn't need to byte-match the backend's
// own default_soul_content() (backend/app/utils/soul.py), which writes the
// exact same file if the user never touches this step. This is just what
// the wizard shows before the user has a chance to edit or accept it.
function clientDefaultSoul(name: string, role: string): string {
  const who = name.trim() || "this agent";
  const what = role.trim() || "AI Assistant";
  return `# ${who}

## Core Identity

This is ${who}'s SOUL.md — loaded into context on every task, on top of the role
(${what}), which is already set separately and doesn't need repeating here. Use this
for what the role doesn't cover: personality, working style, standards to hold to.

## Responsibilities

- When a brief is ambiguous, make a reasonable call and say what you assumed.

## Behavioral Guidelines

**Do:**
- Explain your reasoning briefly when a decision isn't obvious.
- Follow existing patterns already present in a workspace.

**Don't:**
- Don't invent facts or claim to have done something you didn't.
- Don't touch files or systems outside what the task requires.

## Notes

Edits here take effect on your next task — no restart needed. You can also edit this
later from the Command Center's file browser.`;
}

const COLOR_PRESETS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#ec4899", // Pink
  "#8b5cf6", // Violet
];

// Deliberately not coding-only: agents in Cubicle are general-purpose
// workers now (see the agents-as-tools delegation feature), not just dev
// tools — a team should plausibly include an image generator or a
// copywriter alongside a backend dev. These are quick-fill starting
// points only; the textarea below has always been fully freeform, so
// nothing here limits what a user can actually type.
const ROLE_PRESETS = [
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

const STEPS = [
  { id: "identity", label: "Identity", icon: User },
  { id: "engine", label: "Engine", icon: Cpu },
  { id: "workspace", label: "Workspace", icon: FolderGit2 },
  { id: "briefing", label: "Role", icon: Sparkles },
  { id: "soul", label: "Soul", icon: BookHeart },
];

export function AddAgentDialog({ open, onOpenChange }: AddAgentDialogProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const createAgent = useCreateAgent();

  // Same 5 steps regardless of engine type: every agent gets a real
  // workspace now (create_agent bootstraps one — SOUL.md, memory, the file
  // browser all live there — even for API-engine agents, which don't
  // execute *in* it the way a CLI subprocess does, but still use it).
  // Soul stays last since its auto-seed reads `role`, only known once
  // Briefing has been filled in.
  const steps = STEPS;

  function reset() {
    setStep(0);
    setForm(DEFAULT_STATE);
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  const currentStepId = steps[step]?.id;

  // Selecting "Custom / Bring your own API" sets engineProvider to "" (see
  // the Select's onValueChange below), which reveals a plain text input
  // bound directly to engineProvider — the field the user types the real
  // provider prefix (e.g. "gemini") into *is* the value that gets
  // submitted, no parallel state needed. So "custom" is true whenever
  // engineProvider isn't one of the two known presets, including while
  // it's still empty right after picking Custom.
  const isCustomApi = form.engineType === "api" && !BUILTIN_API_PROVIDERS.has(form.engineProvider);

  const canGoNext =
    (currentStepId === "identity" && form.name.trim().length > 0) ||
    (currentStepId === "engine" &&
      (isCustomApi
        ? form.engineProvider.trim().length > 0 &&
          form.engineModel.trim().length > 0 &&
          form.engineApiKey.trim().length > 0
        : form.engineProvider.length > 0)) ||
    currentStepId === "soul" ||
    currentStepId === "workspace" ||
    currentStepId === "briefing";

  // Lazily seed the soul textarea the first time the wizard reaches that
  // step, rather than pre-filling it in DEFAULT_STATE — this way it picks
  // up whatever name the user already typed on the Identity step. Known,
  // accepted limitation: role is collected later (Briefing step), so the
  // seed uses the "AI Assistant" fallback and won't retroactively update if
  // the user fills in a role afterward — fine, since this is just a
  // starting point the user can edit, not a live-synced preview.
  useEffect(() => {
    if (currentStepId === "soul" && form.soul === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding a default on first visit to this step, not deriving state from props every render
      setForm((f) => ({ ...f, soul: clientDefaultSoul(f.name, f.role) }));
    }
  }, [currentStepId, form.soul, form.name, form.role]);

  async function handleSubmit() {
    try {
      const created = await createAgent.mutateAsync({
        name: form.name.trim(),
        role: form.role.trim() || "AI Assistant",
        engine_type: form.engineType,
        engine_provider: form.engineProvider,
        engine_model: form.engineModel.trim() || null,
        engine_command: form.engineType === "cli" ? form.engineCommand.trim() || null : null,
        engine_api_key: form.engineType === "api" ? form.engineApiKey.trim() || null : null,
        // Every agent gets a real workspace now (SOUL.md, memory, the file
        // browser all live there), not just CLI-subprocess agents that
        // actually execute inside it — so this is no longer CLI-gated.
        working_directory: form.workingDirectory.trim() || null,
        allowed_tools:
          form.engineType === "cli" && form.allowedTools.trim()
            ? form.allowedTools.split(",").map((t) => t.trim()).filter(Boolean)
            : null,
        // Picker removed from this wizard for now (personality/quirks config
        // is deferred to phase 2) — personality_traits is still a required
        // field on the backend, so send an empty default rather than making
        // it optional there for what's meant to be a temporary UI cut.
        personality_traits: [],
        accent_color: form.accentColor,
      });
      // Own try/catch: agent creation already succeeded at this point (it
      // even wrote its own default SOUL.md server-side), so a soul-save
      // failure here shouldn't read as the whole thing having failed.
      try {
        await api.agents.writeSoul(created.id, form.soul);
      } catch {
        toast.error(
          `${form.name} was created, but its SOUL.md couldn't be saved — edit it later from the Command Center.`,
        );
      }
      toast.success(`${form.name} joined the office HQ`);
      close();
    } catch {
      toast.error("Couldn't create agent — check console/API logs");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card"
      >
        {/* Stepper Header Header Banner */}
        <div className="bg-slate-900 border-b border-white/10 px-6 py-5 text-white">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30">
                  <Sparkles className="size-4" />
                </span>
                <DialogTitle className="text-base font-bold text-slate-100">
                  Add New Autonomous Agent
                </DialogTitle>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wider text-primary border border-primary/20">
                Step {step + 1} of {steps.length}
              </span>
            </div>
            <DialogDescription className="text-xs text-slate-400 mt-1">
              Configure the engine, workspace, role, and behavior for a new agent.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Navigation Progress Bar */}
          <div className="mt-5 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-slate-800 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300 z-0"
              style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
            />

            <div className="relative z-10 flex justify-between">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const isCompleted = idx < step;
                const isActive = idx === step;

                return (
                  <button
                    key={s.id}
                    onClick={() => isCompleted && setStep(idx)}
                    disabled={!isCompleted}
                    className={`flex flex-col items-center gap-1.5 transition-all ${
                      isCompleted ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div
                      className={`flex size-9 items-center justify-center rounded-full border text-xs font-bold transition-all shadow-md ${
                        isCompleted
                          ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                          : isActive
                            ? "bg-primary border-primary/70 text-primary-foreground shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_50%,transparent)] ring-4 ring-primary/20"
                            : "bg-slate-950 border-slate-800 text-slate-500"
                      }`}
                    >
                      {isCompleted ? <Check className="size-4 stroke-[3]" /> : <Icon className="size-4" />}
                    </div>
                    <span
                      className={`text-2xs font-bold ${
                        isActive
                          ? "text-primary font-extrabold"
                          : isCompleted
                            ? "text-emerald-400"
                            : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Form Body Container — fixed height so the dialog doesn't resize between steps */}
        <div className="soft-scrollbar h-[min(460px,60dvh)] overflow-y-auto p-6">
          {/* STEP 1: IDENTITY */}
          {currentStepId === "identity" && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6 items-start">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agent-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Agent Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="agent-name"
                    placeholder="e.g. Priya, Alex, DevBot"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-10 text-sm font-medium"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Accent Theme Color
                  </Label>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, accentColor: color }))}
                        className={`size-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center shadow-md ${
                          form.accentColor === color ? "ring-2 ring-primary ring-offset-2 scale-110" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {form.accentColor === color && <Check className="size-3.5 text-white" />}
                      </button>
                    ))}
                    <Input
                      type="color"
                      title="Custom color"
                      className="size-7 shrink-0 rounded-full border-none p-0 cursor-pointer shadow-md [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/60 [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
                      value={form.accentColor}
                      onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                    />
                  </div>
                </div>

              </div>

              {/* Live Preview Avatar Card */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-muted p-4 text-center shadow-lg">
                <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Live Avatar Preview
                </span>
                <div
                  className="flex size-20 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-xl transition-all border-2 border-white/20"
                  style={{ backgroundColor: form.accentColor }}
                >
                  {form.name.trim() ? form.name.trim()[0].toUpperCase() : "?"}
                </div>
                <h4 className="mt-3 text-sm font-bold text-foreground">
                  {form.name.trim() || "Agent Name"}
                </h4>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-3xs font-bold text-emerald-500 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ready to join HQ
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: ENGINE */}
          {currentStepId === "engine" && (
            <div className="flex flex-col gap-5">
              {/* Choice Cards: API Model vs CLI Agent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      engineType: "api",
                      engineProvider: "anthropic",
                    }))
                  }
                  className={`flex flex-col items-start p-4 rounded-xl border transition-all text-left ${
                    form.engineType === "api"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-md"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Cpu className="size-4" />
                    </div>
                    {form.engineType === "api" && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-foreground">
                    Cloud / Local API Model
                  </h4>
                  <p className="mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                    Runs via Anthropic Claude or local Ollama LLM endpoint.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      engineType: "cli",
                      engineProvider: "claude_code",
                    }))
                  }
                  className={`flex flex-col items-start p-4 rounded-xl border transition-all text-left ${
                    form.engineType === "cli"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-md"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Terminal className="size-4" />
                    </div>
                    {form.engineType === "cli" && <CheckCircle2 className="size-4 text-emerald-500" />}
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-foreground">
                    CLI Terminal Agent
                  </h4>
                  <p className="mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                    Runs an autonomous terminal coding agent (Claude Code, OpenCode, etc.).
                  </p>
                </button>
              </div>

              {/* Provider Selector */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Engine Provider
                </Label>
                <Select
                  value={isCustomApi ? "custom" : form.engineProvider}
                  onValueChange={(v) => {
                    if (!v) return;
                    // "custom" is a UI-only pseudo-selection — engineProvider
                    // is cleared so the text input below becomes the actual
                    // value the user types the real provider prefix into.
                    setForm((f) => ({ ...f, engineProvider: v === "custom" ? "" : v }));
                  }}
                  items={Object.fromEntries(
                    (form.engineType === "cli" ? CLI_PROVIDERS : API_PROVIDERS).map((p) => [p.value, p.label]),
                  )}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(form.engineType === "cli" ? CLI_PROVIDERS : API_PROVIDERS).map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{p.label}</span>
                          {"verified" in p && Boolean((p as { verified?: boolean }).verified) && (
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-4xs font-bold text-emerald-500 border border-emerald-500/20">
                              VERIFIED
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Provider Prefix — the field the user types into IS
                  form.engineProvider (e.g. "gemini", "groq", "mistral"); no
                  parallel state, see isCustomApi above. */}
              {isCustomApi && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agent-custom-provider" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Provider Prefix <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="agent-custom-provider"
                    placeholder="gemini, openai, groq, mistral…"
                    value={form.engineProvider}
                    onChange={(e) => setForm((f) => ({ ...f, engineProvider: e.target.value }))}
                    className="font-mono text-sm"
                  />
                  <p className="text-3xs text-slate-500 dark:text-slate-400">
                    Any LiteLLM provider prefix — the model gets called as{" "}
                    <code>{`${form.engineProvider || "provider"}/${form.engineModel || "model"}`}</code>.
                  </p>
                </div>
              )}

              {/* Inline Claude Code connect flow — a new user picking this
                  provider shouldn't have to abandon the wizard, go to
                  Settings, connect, and start over. Same self-contained
                  component either surface uses. */}
              {form.engineType === "cli" && form.engineProvider === "claude_code" && (
                <ClaudeAuthCard />
              )}

              {/* Model Name — required for a custom API provider (there's
                  no sensible default the way ollama/anthropic have one). */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-model" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Specific Model String {isCustomApi ? <span className="text-rose-500">*</span> : "(optional)"}
                </Label>
                <Input
                  id="agent-model"
                  placeholder={
                    isCustomApi
                      ? "gemini-1.5-pro"
                      : form.engineType === "cli"
                        ? "claude-3-7-sonnet / gpt-4o"
                        : "claude-3-7-sonnet-20250219 / llama3.1:8b"
                  }
                  value={form.engineModel}
                  onChange={(e) => setForm((f) => ({ ...f, engineModel: e.target.value }))}
                />
              </div>

              {/* API Key — bring-your-own credential for a custom provider,
                  encrypted at rest server-side, never echoed back. */}
              {isCustomApi && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agent-api-key" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    API Key <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="agent-api-key"
                    type="password"
                    placeholder="sk-…"
                    value={form.engineApiKey}
                    onChange={(e) => setForm((f) => ({ ...f, engineApiKey: e.target.value }))}
                    className="font-mono text-sm"
                  />
                  <p className="text-3xs text-slate-500 dark:text-slate-400">
                    Stored encrypted — you can rotate or clear it later from the Command Center.
                  </p>
                </div>
              )}

              {/* CLI Specific Tool Controls */}
              {form.engineType === "cli" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agent-tools" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Allowed Tools (comma-separated, optional)
                  </Label>
                  <Input
                    id="agent-tools"
                    placeholder="Read, Write, Edit, Bash, Glob"
                    value={form.allowedTools}
                    onChange={(e) => setForm((f) => ({ ...f, allowedTools: e.target.value }))}
                  />
                </div>
              )}

              {form.engineType === "cli" && !VERIFIED_CLI_PROVIDERS.has(form.engineProvider) && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-500">
                  <Label htmlFor="agent-command" className="text-xs font-bold">
                    Custom CLI Command Override
                  </Label>
                  <Input
                    id="agent-command"
                    placeholder={`${form.engineProvider} exec {prompt}`}
                    value={form.engineCommand}
                    onChange={(e) => setForm((f) => ({ ...f, engineCommand: e.target.value }))}
                    className="bg-card border-amber-500/40 text-xs"
                  />
                  <p className="text-2xs opacity-90">
                    Use <code>{"{prompt}"}</code> as the substitution point for prompts.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: WORKSPACE */}
          {currentStepId === "workspace" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-workdir" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Working Directory Path
                </Label>
                <div className="relative">
                  <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    id="agent-workdir"
                    placeholder={`/workspaces/${form.name.toLowerCase().replace(/\s+/g, "-") || "agent"}`}
                    value={form.workingDirectory}
                    onChange={(e) => setForm((f) => ({ ...f, workingDirectory: e.target.value }))}
                    className="pl-9 h-10 text-sm font-mono"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {form.engineType === "cli"
                    ? "Where this agent's tools run — and, either way, where its SOUL.md, memory notes, and any files it produces live."
                    : "This agent's SOUL.md, memory notes, and any files it produces live here — leave blank to use a generated default."}
                </p>
              </div>

              {/* Quick Directory Presets */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Quick Path Templates
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "/workspaces/frontend",
                    "/workspaces/backend",
                    "/workspaces/ai-lab",
                    "/workspaces/docs",
                  ].map((path) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, workingDirectory: path }))}
                      className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground hover:border-primary/70 hover:text-primary transition-all"
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: BRIEFING */}
          {currentStepId === "briefing" && (
            <div className="flex flex-col gap-5">
              {/* Quick Role Preset Chips */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Wand2 className="size-3.5 text-primary" /> Quick Role Templates
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: `${preset.title}: ${preset.description}` }))}
                      className="flex flex-col items-start p-2.5 rounded-xl border border-border bg-muted hover:border-primary text-left transition-all group"
                    >
                      <span className="text-xs font-bold text-foreground group-hover:text-primary">
                        {preset.title}
                      </span>
                      <span className="text-[10.5px] text-slate-500 line-clamp-1">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role — deliberately short: this is the label shown on the
                  agent card, and it's what a boss agent sees (name + role
                  only, not the full SOUL.md) when deciding who to assign a
                  subtask to. The deeper behavioral stuff — tone, guardrails,
                  working style — belongs in Soul (next step), not here. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-role" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Role / Job Title <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="agent-role"
                  rows={2}
                  placeholder="e.g. Full-Stack Developer — keep this short, it's shown everywhere as this agent's label"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="text-xs"
                />
                <p className="text-3xs text-slate-500 dark:text-slate-400">
                  Kept short on purpose — this is the label used on the agent card and given to
                  a boss agent when it&apos;s deciding who to assign work to. For behavior, tone,
                  and working style, use the Soul step next.
                </p>
              </div>

              {/* Agent Configuration Summary Review Card */}
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-xs space-y-2">
                <span className="text-3xs font-black uppercase tracking-wider text-primary">
                  Final Configuration Review
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400">Name: </span>
                    <span className="font-bold text-foreground">{form.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Engine: </span>
                    <span className="font-bold uppercase text-primary">
                      {form.engineType} ({form.engineProvider})
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Role: </span>
                    <span className="font-medium">{form.role || "AI Assistant"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP: SOUL — last, since its auto-seed reads form.role, only
              known once the Briefing step above has been filled in. */}
          {currentStepId === "soul" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3">
                <BookHeart className="size-4 shrink-0 text-primary mt-0.5" />
                <p className="text-2xs leading-relaxed text-slate-600 dark:text-slate-300">
                  This is your agent&apos;s <strong>SOUL.md</strong> — a real file in its
                  workspace that describes who it is and how it should work. It&apos;s loaded
                  into context on every task. Edit the starting point below, or accept it as-is
                  — either way, you can always change it later from the Command Center&apos;s
                  file browser.
                </p>
              </div>
              <Textarea
                id="agent-soul"
                rows={11}
                value={form.soul}
                onChange={(e) => setForm((f) => ({ ...f, soul: e.target.value }))}
                className="font-mono text-2xs leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Stepper Footer Controls */}
        <DialogFooter className="m-0 bg-muted border-t border-border px-6 py-3.5 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground hover:text-foreground">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="size-3.5 mr-1" />
                Back
              </Button>
            )}

            {step < steps.length - 1 ? (
              <Button
                size="sm"
                disabled={!canGoNext}
                onClick={() => setStep((s) => s + 1)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Next
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createAgent.isPending || !form.name.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {createAgent.isPending ? (
                  "Creating..."
                ) : (
                  <>
                    <Check className="size-4 mr-1 stroke-[3]" />
                    Create Agent
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
