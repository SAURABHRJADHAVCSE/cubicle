"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EngineStatusList } from "@/components/setup/EngineStatusList";
import { TaskResult } from "@/components/tasks/TaskResult";
import { useCreateAgent } from "@/hooks/useAgents";
import { useEngines } from "@/hooks/useEngines";
import { useCreateTask, useExecuteTask } from "@/hooks/useTasks";
import { AGENT_TEMPLATES } from "@/lib/constants";
import { api } from "@/lib/api";
import type { Task } from "@/types/task";

const STEPS = ["Detect engines", "Configure", "Try a demo task"] as const;

export function OnboardingWizard() {
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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-12 px-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-heading text-2xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
          Welcome to Cubicle
        </h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Set up your autonomous AI office in 3 quick steps
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
              i === step
                ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                : i < step
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-slate-300 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 text-slate-400"
            }`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-black/20 text-[10px]">
              {i + 1}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <Card className="glass-panel brutal-card border-slate-300 dark:border-white/15 bg-white/90 dark:bg-slate-900/80 p-5 shadow-xl">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            {STEPS[step]}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <EngineStatusList />
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Cubicle auto-detects LLM engine providers: <strong>Claude Code CLI</strong>, local <strong>Ollama</strong> server, and <strong>Anthropic API</strong> credentials.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3.5 text-xs">
              {anyEngineAvailable ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300 font-semibold">
                  ✓ At least one AI engine is active and ready to process agent tasks!
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300 font-medium">
                  No engine detected yet. Add credentials to your <code>.env</code> file or set up an API provider in Settings.
                </div>
              )}
              {missing.includes("anthropic_api") && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/60 p-3 text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-slate-900 dark:text-white">Anthropic API Key:</p>
                  <p className="mt-1">Add <code>ANTHROPIC_API_KEY=sk-ant-…</code> in your environment file or Settings page.</p>
                </div>
              )}
              {missing.includes("ollama") && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/60 p-3 text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-slate-900 dark:text-white">Ollama Local Models:</p>
                  <p className="mt-1">Run <code>docker compose --profile ollama up -d</code> for a free local offline engine.</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Select a starter agent template to execute a live test task:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AGENT_TEMPLATES.map((template, i) => (
                  <Button
                    key={template.name}
                    size="sm"
                    variant="outline"
                    disabled={running}
                    className="h-auto flex-col items-start justify-start p-3 text-left border-slate-300 dark:border-white/10 bg-white dark:bg-slate-800 hover:border-indigo-500"
                    onClick={() => runDemo(i)}
                  >
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{template.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{template.role}</span>
                  </Button>
                ))}
              </div>
              {running && (
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span className="size-2 rounded-full bg-indigo-500 animate-ping" />
                  Agent is processing demo task…
                </div>
              )}
              {demoTask && <TaskResult task={demoTask} />}
            </div>
          )}
        </CardContent>
      </Card>

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
            className="rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-500 shadow-md"
            onClick={() => setStep((s) => s + 1)}
          >
            Next
          </Button>
        ) : (
          <Button
            className="rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-md"
            render={<Link href="/" />}
            nativeButton={false}
          >
            Enter Office
          </Button>
        )}
      </div>
    </div>
  );
}
