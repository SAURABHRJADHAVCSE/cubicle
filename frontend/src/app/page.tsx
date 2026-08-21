"use client";

import Link from "next/link";

import { AgentList } from "@/components/agents/AgentList";
import { TaskHistory } from "@/components/tasks/TaskHistory";
import { useAgents } from "@/hooks/useAgents";

export default function Home() {
  const { data: agents } = useAgents();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Cubicle</h1>
        {agents?.length === 0 && (
          <Link href="/setup" className="text-sm text-primary underline underline-offset-4">
            First time here? Run setup
          </Link>
        )}
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-6 md:grid-cols-[320px_1fr]">
        <aside className="overflow-hidden">
          <AgentList />
        </aside>
        <main className="overflow-hidden">
          <TaskHistory />
        </main>
      </div>
    </div>
  );
}
