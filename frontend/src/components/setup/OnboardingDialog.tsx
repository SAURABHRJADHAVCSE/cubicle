"use client";

import { useState } from "react";
import { toast } from "sonner";

import { EngineCard } from "@/components/settings/EngineCard";
import { TaskResult } from "@/components/tasks/TaskResult";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateAgent } from "@/hooks/useAgents";
import { useEngines } from "@/hooks/useEngines";
import { useCreateTask, useExecuteTask } from "@/hooks/useTasks";
import { api } from "@/lib/api";
import { AGENT_TEMPLATES } from "@/lib/constants";
import { engineInfo } from "@/lib/engineInfo";
import type { Task } from "@/types/task";

const STEPS = ["Detect engines", "Configure", "Try a demo task"] as const;

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** First-run wizard, in-place — opens over the dashboard instead of
 * navigating to a separate /setup route. Finishing (or closing) it just
 * dismisses the dialog rather than doing another page navigation. */
export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const { data: engines } = useEngines();
  const createAgent = useCreateAgent();
  const createTask = useCreateTask();
  const executeTask = useExecuteTask();

  const [demoTask, setDemoTask] = useState<Task | null>(null);
  const [running, setRunning] = useState(false);

  const anyEngineAvailable = engines ? Object.values(engines).some(Boolean) : false;
  const missing = engines
    ? Object.entries(engines).filter(([, available]) => !available).map(([k]) => k)
    : [];

  async function runDemo(templateIndex: number) {
    const template = AGENT_TEMPLATES[templateIndex];
    setRunning(true);
    setDemoTask(null);
    try {
      const agent = await createAgent.mutateAsync({
        name: template.name,
        role: template.role,
        engine_type: template.engine_type,
        engine_provider: template.engine_provider,
        personality_traits: template.traits,
        personality_quirks: template.quirks,
        accent_color: template.accent_color,
        working_directory:
          template.engine_type === "cli" ? `/workspaces/${template.name.toLowerCase()}` : null,
      });

      const task = await createTask.mutateAsync({
        title: "Say hello",
        brief: `Reply with exactly one short, friendly sentence introducing yourself as ${template.name}, the ${template.role}.`,
        assigned_agents: [agent.id],
      });
      await executeTask.mutateAsync(task.id);

      // Poll until the task finishes — Socket.io will take over live updates
      // once this wizard is done; here we just need the demo to resolve.
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const latest = await api.tasks.get(task.id);
        setDemoTask(latest);
        if (latest.status === "completed" || latest.status === "failed") break;
      }
    } catch {
      toast.error("Demo task failed — check engine configuration and API logs");
    } finally {
      setRunning(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setStep(0);
      setDemoTask(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Three fixed zones (header/step-dots, scrollable body, Back/Next
          footer), not one scrolling box — the previous single overflow-y-auto
          container let the title and step indicator scroll away with the
          content, and the dialog's overall height changed per step. */}
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-xl" showCloseButton>
        <div className="shrink-0 p-4 pb-0">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="font-heading text-xl font-extrabold tracking-tight text-foreground uppercase">
              Welcome to Cubicle
            </DialogTitle>
            <DialogDescription>
              Set up your autonomous AI office in 3 quick steps.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex items-center justify-center gap-2">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                  i === step
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : i < step
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border bg-card/60 text-muted-foreground"
                }`}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-black/20 text-3xs">
                  {i + 1}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[min(420px,55dvh)] overflow-y-auto soft-scrollbar p-4">
        <div className="glass-panel rounded-lg border border-border bg-card/90 p-5 shadow-lg">
          <h3 className="mb-4 font-heading text-lg font-bold tracking-wide text-foreground uppercase">
            {STEPS[step]}
          </h3>

          {step === 0 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.keys(engines ?? {}).map((key) => (
                  <EngineCard key={key} engineKey={key} />
                ))}
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Cubicle auto-detects every engine it supports — CLI tools on your PATH, a local
                Ollama server, and Anthropic API credentials.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3.5 text-xs">
              {anyEngineAvailable ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ At least one AI engine is active and ready to process agent tasks!
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 font-medium text-amber-700 dark:text-amber-300">
                  No engine detected yet — pick one below to get started.
                </div>
              )}
              {missing.length > 0 && (
                <div className="flex flex-col gap-2">
                  {missing.map((key) => (
                    <div
                      key={key}
                      className="rounded-lg border border-border bg-muted p-3 text-muted-foreground"
                    >
                      <p className="font-bold text-foreground">{engineInfo(key).label}</p>
                      <p className="mt-1">{engineInfo(key).guidance}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3.5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Select a starter agent template to execute a live test task:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AGENT_TEMPLATES.map((template, i) => (
                  <Button
                    key={template.name}
                    size="sm"
                    variant="outline"
                    disabled={running}
                    className="h-auto flex-col items-start justify-start rounded-lg border-border bg-card p-3 text-left hover:border-primary"
                    onClick={() => runDemo(i)}
                  >
                    <span className="text-xs font-bold text-foreground">{template.name}</span>
                    <span className="text-3xs text-slate-500 dark:text-slate-400">{template.role}</span>
                  </Button>
                ))}
              </div>
              {running && (
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <span className="size-2 animate-ping rounded-full bg-primary" />
                  Agent is processing demo task…
                </div>
              )}
              {demoTask && <TaskResult task={demoTask} />}
            </div>
          )}
        </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border p-4">
          <Button
            variant="outline"
            disabled={step === 0}
            className="rounded-lg border-border"
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              className="rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              className="rounded-lg bg-success font-bold text-success-foreground shadow-sm hover:bg-success/90"
              onClick={() => handleOpenChange(false)}
            >
              Enter Office
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
