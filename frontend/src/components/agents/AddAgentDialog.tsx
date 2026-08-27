"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  FolderGit2,
  Sparkles,
  Terminal,
  User,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { PERSONALITY_TRAIT_CATEGORIES } from "@/lib/constants";
import type { EngineType } from "@/types/agent";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  accentColor: string;
  traits: string[];
  quirks: string;
  engineType: EngineType;
  engineProvider: string;
  engineModel: string;
  engineCommand: string;
  allowedTools: string;
  workingDirectory: string;
  role: string;
}

const DEFAULT_STATE: FormState = {
  name: "",
  accentColor: "#6366f1",
  traits: ["focused", "analytical"],
  quirks: "",
  engineType: "api",
  engineProvider: "anthropic",
  engineModel: "",
  engineCommand: "",
  allowedTools: "",
  workingDirectory: "",
  role: "",
};

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

const CLI_PROVIDERS = [
  { value: "claude_code", label: "Claude Code", verified: true },
  { value: "opencode", label: "OpenCode", verified: true },
  { value: "codex", label: "Codex", verified: false },
  { value: "grok", label: "Grok", verified: false },
  { value: "gemini", label: "Gemini", verified: false },
  { value: "antigravity", label: "Antigravity", verified: false },
  { value: "qwen", label: "Qwen", verified: false },
];

const VERIFIED_CLI_PROVIDERS = new Set(["claude_code", "opencode"]);

const API_PROVIDERS = [
  { value: "anthropic", label: "Anthropic API" },
  { value: "ollama", label: "Ollama (Local)" },
];

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
];

export function AddAgentDialog({ open, onOpenChange }: AddAgentDialogProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const createAgent = useCreateAgent();

  const steps = useMemo(
    () =>
      form.engineType === "cli"
        ? [
            { id: "identity", label: "Identity", icon: User },
            { id: "engine", label: "Engine", icon: Cpu },
            { id: "workspace", label: "Workspace", icon: FolderGit2 },
            { id: "briefing", label: "Briefing", icon: Sparkles },
          ]
        : [
            { id: "identity", label: "Identity", icon: User },
            { id: "engine", label: "Engine", icon: Cpu },
            { id: "briefing", label: "Briefing", icon: Sparkles },
          ],
    [form.engineType],
  );

  function reset() {
    setStep(0);
    setForm(DEFAULT_STATE);
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  function toggleTrait(trait: string) {
    setForm((f) => ({
      ...f,
      traits: f.traits.includes(trait)
        ? f.traits.filter((t) => t !== trait)
        : [...f.traits, trait],
    }));
  }

  const currentStepId = steps[step]?.id;

  const canGoNext =
    (currentStepId === "identity" && form.name.trim().length > 0) ||
    (currentStepId === "engine" && form.engineProvider.length > 0) ||
    currentStepId === "workspace" ||
    currentStepId === "briefing";

  async function handleSubmit() {
    try {
      await createAgent.mutateAsync({
        name: form.name.trim(),
        role: form.role.trim() || "AI Assistant",
        engine_type: form.engineType,
        engine_provider: form.engineProvider,
        engine_model: form.engineModel.trim() || null,
        engine_command: form.engineType === "cli" ? form.engineCommand.trim() || null : null,
        working_directory: form.engineType === "cli" ? form.workingDirectory.trim() || null : null,
        allowed_tools:
          form.engineType === "cli" && form.allowedTools.trim()
            ? form.allowedTools.split(",").map((t) => t.trim()).filter(Boolean)
            : null,
        personality_traits: form.traits,
        personality_quirks: form.quirks.trim()
          ? form.quirks.split("\n").map((q) => q.trim()).filter(Boolean)
          : null,
        accent_color: form.accentColor,
      });
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
        className="sm:max-w-2xl p-0 overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-950"
      >
        {/* Stepper Header Header Banner */}
        <div className="bg-slate-900 border-b border-white/10 px-6 py-5 text-white">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles className="size-4" />
                </span>
                <DialogTitle className="text-base font-bold text-slate-100">
                  Add New Autonomous Agent
                </DialogTitle>
              </div>
              <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 border border-indigo-500/20">
                Step {step + 1} of {steps.length}
              </span>
            </div>
            <DialogDescription className="text-xs text-slate-400 mt-1">
              Configure agent personality, AI engine model, workspace, and role briefing.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Navigation Progress Bar */}
          <div className="mt-5 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-slate-800 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-indigo-500 transition-all duration-300 z-0"
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
                            ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)] ring-4 ring-indigo-500/20"
                            : "bg-slate-950 border-slate-800 text-slate-500"
                      }`}
                    >
                      {isCompleted ? <Check className="size-4 stroke-[3]" /> : <Icon className="size-4" />}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        isActive
                          ? "text-indigo-400 font-extrabold"
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
        <div className="soft-scrollbar h-[460px] overflow-y-auto p-6">
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
                          form.accentColor === color ? "ring-2 ring-indigo-500 ring-offset-2 scale-110" : ""
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

                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Personality Traits
                  </Label>
                  <div className="soft-scrollbar flex max-h-48 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 p-3">
                    {Object.entries(PERSONALITY_TRAIT_CATEGORIES).map(([category, traits]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <span className="size-1 rounded-full bg-indigo-400" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {category.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {traits.map((trait) => {
                            const isSelected = form.traits.includes(trait);
                            return (
                              <button
                                key={trait}
                                type="button"
                                onClick={() => toggleTrait(trait)}
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                }`}
                              >
                                {isSelected && <Check className="size-3 stroke-[3]" />}
                                {trait.replace(/_/g, " ")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agent-quirks" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Quirks & Habits (one per line, optional)
                  </Label>
                  <Textarea
                    id="agent-quirks"
                    rows={2}
                    placeholder="Always drinks espresso before coding&#10;Prefers functional code patterns"
                    value={form.quirks}
                    onChange={(e) => setForm((f) => ({ ...f, quirks: e.target.value }))}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Live Preview Avatar Card */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-4 text-center shadow-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Live Avatar Preview
                </span>
                <div
                  className="flex size-20 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-xl transition-all border-2 border-white/20"
                  style={{ backgroundColor: form.accentColor }}
                >
                  {form.name.trim() ? form.name.trim()[0].toUpperCase() : "?"}
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                  {form.name.trim() || "Agent Name"}
                </h4>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
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
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-md"
                      : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                      <Cpu className="size-4" />
                    </div>
                    {form.engineType === "api" && <CheckCircle2 className="size-4 text-indigo-500" />}
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                    Cloud / Local API Model
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
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
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-md"
                      : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Terminal className="size-4" />
                    </div>
                    {form.engineType === "cli" && <CheckCircle2 className="size-4 text-emerald-500" />}
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                    CLI Terminal Agent
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
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
                  value={form.engineProvider}
                  onValueChange={(v) => v && setForm((f) => ({ ...f, engineProvider: v }))}
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
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500 border border-emerald-500/20">
                              VERIFIED
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-model" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Specific Model String (optional)
                </Label>
                <Input
                  id="agent-model"
                  placeholder={
                    form.engineType === "cli"
                      ? "claude-3-7-sonnet / gpt-4o"
                      : "claude-3-7-sonnet-20250219 / llama3.1:8b"
                  }
                  value={form.engineModel}
                  onChange={(e) => setForm((f) => ({ ...f, engineModel: e.target.value }))}
                />
              </div>

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
                    className="bg-white dark:bg-slate-900 border-amber-500/40 text-xs"
                  />
                  <p className="text-[11px] opacity-90">
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
                  The local directory where this agent execution process will run.
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
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 text-xs font-mono text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-400 transition-all"
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
                  <Wand2 className="size-3.5 text-indigo-500" /> Quick Role Templates
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: `${preset.title}: ${preset.description}` }))}
                      className="flex flex-col items-start p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500 text-left transition-all group"
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-500">
                        {preset.title}
                      </span>
                      <span className="text-[10.5px] text-slate-500 line-clamp-1">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role Briefing Textarea */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-role" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Role Description & Scope <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="agent-role"
                  rows={3}
                  placeholder="Screens incoming code tasks, resolves backend bugs, and writes documentation..."
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="text-xs"
                />
              </div>

              {/* Agent Configuration Summary Review Card */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                  Final Configuration Review
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400">Name: </span>
                    <span className="font-bold text-slate-900 dark:text-white">{form.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Engine: </span>
                    <span className="font-bold uppercase text-indigo-400">
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
        </div>

        {/* Stepper Footer Controls */}
        <DialogFooter className="m-0 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-white/10 px-6 py-3.5 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={close} className="text-slate-500 hover:text-slate-900">
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
