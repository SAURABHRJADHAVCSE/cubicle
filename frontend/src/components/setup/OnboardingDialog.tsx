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
      <DialogContent className="max-h-[85vh] overflow-y-auto soft-scrollbar sm:max-w-xl" showCloseButton>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-heading text-xl font-extrabold tracking-tight text-slate-900 uppercase dark:text-white">
            Welcome to Cubicle
          </DialogTitle>
          <DialogDescription>
            Set up your autonomous AI office in 3 quick steps.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                i === step
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                  : i < step
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-slate-300 bg-white/60 text-slate-400 dark:border-white/10 dark:bg-slate-900/40"
              }`}
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-black/20 text-[10px]">
                {i + 1}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="glass-panel brutal-card rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-xl dark:border-white/15 dark:bg-slate-900/80">
          <h3 className="mb-4 font-heading text-lg font-bold tracking-wide text-slate-900 uppercase dark:text-slate-100">
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
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ At least one AI engine is active and ready to process agent tasks!
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 font-medium text-amber-700 dark:text-amber-300">
                  No engine detected yet — pick one below to get started.
                </div>
              )}
              {missing.length > 0 && (
                <div className="flex flex-col gap-2">
                  {missing.map((key) => (
                    <div
                      key={key}
                      className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-slate-600 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300"
                    >
                      <p className="font-bold text-slate-900 dark:text-white">{engineInfo(key).label}</p>
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
                    className="h-auto flex-col items-start justify-start border-slate-300 bg-white p-3 text-left hover:border-indigo-500 dark:border-white/10 dark:bg-slate-800"
                    onClick={() => runDemo(i)}
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{template.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{template.role}</span>
                  </Button>
                ))}
              </div>
              {running && (
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span className="size-2 animate-ping rounded-full bg-indigo-500" />
                  Agent is processing demo task…
                </div>
              )}
              {demoTask && <TaskResult task={demoTask} />}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={step === 0}
            className="rounded-xl border-slate-300 dark:border-white/10"
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              className="rounded-xl bg-indigo-600 font-bold text-white shadow-md hover:bg-indigo-500"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              className="rounded-xl bg-emerald-600 font-bold text-white shadow-md hover:bg-emerald-500"
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
