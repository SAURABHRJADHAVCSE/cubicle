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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-16">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <Badge key={label} variant={i === step ? "default" : "outline"}>
            {i + 1}. {label}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 0 && (
            <>
              <EngineStatusList />
              <p className="text-xs text-muted-foreground">
                Cubicle looks for the Claude Code CLI on PATH, a local Ollama server, and an
                Anthropic API key.
              </p>
            </>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3 text-sm">
              {anyEngineAvailable ? (
                <p>At least one engine is ready — you&apos;re good to go.</p>
              ) : (
                <p className="text-muted-foreground">
                  No engine detected yet. Add credentials to your <code>.env</code> file and
                  restart the stack (<code>docker compose up -d</code>).
                </p>
              )}
              {missing.includes("anthropic_api") && (
                <p className="text-muted-foreground">
                  Set <code>ANTHROPIC_API_KEY=sk-ant-…</code> to enable the Anthropic and Claude
                  Code CLI engines.
                </p>
              )}
              {missing.includes("ollama") && (
                <p className="text-muted-foreground">
                  Run <code>docker compose --profile ollama up -d</code> for a free local engine.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Pick a starter agent to see the full loop: create agent → submit task → get a
                result.
              </p>
              <div className="flex flex-wrap gap-2">
                {AGENT_TEMPLATES.map((template, i) => (
                  <Button
                    key={template.name}
                    size="sm"
                    variant="outline"
                    disabled={running}
                    onClick={() => runDemo(i)}
                  >
                    {template.name} — {template.role}
                  </Button>
                ))}
              </div>
              {running && <p className="text-sm text-muted-foreground">Working…</p>}
              {demoTask && <TaskResult task={demoTask} />}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : (
          <Button render={<Link href="/" />} nativeButton={false}>Go to office</Button>
        )}
      </div>
    </div>
  );
}
