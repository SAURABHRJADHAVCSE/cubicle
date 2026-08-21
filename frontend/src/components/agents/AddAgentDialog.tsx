"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  allowedTools: string;
  workingDirectory: string;
  role: string;
}

const DEFAULT_STATE: FormState = {
  name: "",
  accentColor: "#6366f1",
  traits: [],
  quirks: "",
  engineType: "api",
  engineProvider: "anthropic",
  engineModel: "",
  allowedTools: "",
  workingDirectory: "",
  role: "",
};

const CLI_PROVIDERS = [{ value: "claude_code", label: "Claude Code" }];
const API_PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama", label: "Ollama (local)" },
];

/**
 * Mirrors cubicle_spec.md's 4-step Add Agent flow (Identity, Workspace,
 * Engine, Briefing) with one reordering: Engine comes before Workspace,
 * since whether a Workspace step is even shown depends on the engine type
 * chosen — the spec's literal step order can't actually be evaluated in
 * its given sequence.
 */
export function AddAgentDialog({ open, onOpenChange }: AddAgentDialogProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const createAgent = useCreateAgent();

  const steps = useMemo(
    () =>
      form.engineType === "cli"
        ? (["Identity", "Engine", "Workspace", "Briefing"] as const)
        : (["Identity", "Engine", "Briefing"] as const),
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

  const canGoNext =
    (steps[step] === "Identity" && form.name.trim().length > 0) ||
    (steps[step] === "Engine" && form.engineProvider.length > 0) ||
    steps[step] === "Workspace" ||
    steps[step] === "Briefing";

  async function handleSubmit() {
    try {
      await createAgent.mutateAsync({
        name: form.name.trim(),
        role: form.role.trim() || "Agent",
        engine_type: form.engineType,
        engine_provider: form.engineProvider,
        engine_model: form.engineModel.trim() || null,
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
      toast.success(`${form.name} joined the office`);
      close();
    } catch {
      toast.error("Couldn't create agent — check the console/API logs");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {steps.length}: {steps[step]}
          </DialogDescription>
        </DialogHeader>

        {steps[step] === "Identity" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="Priya"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-color">Accent color</Label>
              <Input
                id="agent-color"
                type="color"
                className="h-9 w-16 p-1"
                value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Personality</Label>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto rounded-md border p-2">
                {Object.entries(PERSONALITY_TRAIT_CATEGORIES).map(([category, traits]) => (
                  <div key={category} className="flex flex-wrap items-center gap-3">
                    {traits.map((trait) => (
                      <label key={trait} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={form.traits.includes(trait)}
                          onCheckedChange={() => toggleTrait(trait)}
                        />
                        {trait.replace("_", " ")}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-quirks">Quirks (one per line, optional)</Label>
              <Textarea
                id="agent-quirks"
                rows={2}
                value={form.quirks}
                onChange={(e) => setForm((f) => ({ ...f, quirks: e.target.value }))}
              />
            </div>
          </div>
        )}

        {steps[step] === "Engine" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Engine type</Label>
              <Select
                value={form.engineType}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    engineType: v as EngineType,
                    engineProvider: v === "cli" ? "claude_code" : "anthropic",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API Model</SelectItem>
                  <SelectItem value="cli">CLI Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Provider</Label>
              <Select
                value={form.engineProvider}
                onValueChange={(v) => v && setForm((f) => ({ ...f, engineProvider: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(form.engineType === "cli" ? CLI_PROVIDERS : API_PROVIDERS).map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-model">Model (optional — uses a sensible default)</Label>
              <Input
                id="agent-model"
                placeholder={form.engineType === "cli" ? "claude-sonnet-4-5" : "claude-sonnet-4-5 / llama3.2"}
                value={form.engineModel}
                onChange={(e) => setForm((f) => ({ ...f, engineModel: e.target.value }))}
              />
            </div>

            {form.engineType === "cli" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-tools">Allowed tools (comma-separated, optional)</Label>
                <Input
                  id="agent-tools"
                  placeholder="Read, Write, Bash, Edit"
                  value={form.allowedTools}
                  onChange={(e) => setForm((f) => ({ ...f, allowedTools: e.target.value }))}
                />
              </div>
            )}
          </div>
        )}

        {steps[step] === "Workspace" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-workdir">Working directory</Label>
            <Input
              id="agent-workdir"
              placeholder={`/workspaces/${form.name.toLowerCase() || "agent"}`}
              value={form.workingDirectory}
              onChange={(e) => setForm((f) => ({ ...f, workingDirectory: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Where this agent&apos;s CLI runs — mounted from the shared workspace volume.
            </p>
          </div>
        )}

        {steps[step] === "Briefing" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-role">What does this agent do?</Label>
            <Textarea
              id="agent-role"
              rows={3}
              placeholder="Screens incoming resumes and shortlists candidates"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            />
          </div>
        )}

        <DialogFooter>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button disabled={!canGoNext} onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createAgent.isPending}>
              {createAgent.isPending ? "Creating…" : "Create agent"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
