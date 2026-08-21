"use client";

import Link from "next/link";

import { AgentList } from "@/components/agents/AgentList";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { OfficeScene } from "@/components/office/OfficeScene";
import { TaskHistory } from "@/components/tasks/TaskHistory";
import { useAgents } from "@/hooks/useAgents";
import { useUIStore } from "@/stores/uiStore";

export default function Home() {
  const { data: agents } = useAgents();
  const selectedAgentId = useUIStore((s) => s.selectedAgentId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="font-heading text-lg font-semibold">Cubicle</h1>
        {agents?.length === 0 && (
          <Link href="/setup" className="text-sm text-primary underline underline-offset-4">
            First time here? Run setup
          </Link>
        )}
      </header>

      <OfficeScene />

      <div className="flex flex-1 overflow-hidden">
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[320px_1fr] md:overflow-hidden">
          <aside className="min-h-96 md:min-h-0 md:overflow-hidden">
            <AgentList />
          </aside>
          <main className="min-h-96 md:min-h-0 md:overflow-hidden">
            <TaskHistory />
          </main>
        </div>

        {selectedAgentId && <ChatPanel key={selectedAgentId} />}
      </div>
    </div>
  );
}
