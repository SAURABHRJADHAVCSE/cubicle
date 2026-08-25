"use client";

import { Settings } from "lucide-react";
import Link from "next/link";

import { AgentList } from "@/components/agents/AgentList";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { OfficeScene } from "@/components/office/OfficeScene";
import { TaskHistory } from "@/components/tasks/TaskHistory";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";
import { useUIStore } from "@/stores/uiStore";

export default function Home() {
  const { data: agents } = useAgents();
  const selectedAgentId = useUIStore((s) => s.selectedAgentId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="font-heading text-lg font-semibold">Cubicle</h1>
        <div className="flex items-center gap-4">
          {agents?.length === 0 && (
            <Link href="/setup" className="text-sm text-primary underline underline-offset-4">
              First time here? Run setup
            </Link>
          )}
          <Button variant="ghost" size="icon-sm" render={<Link href="/settings" />} nativeButton={false} aria-label="Settings">
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <OfficeScene className="h-72 shrink-0 border-b md:h-auto md:w-[70%] md:min-w-[560px] md:border-b-0 md:border-r" />

        <div className="relative flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6">
            <aside className="h-72 shrink-0 overflow-hidden">
              <AgentList />
            </aside>
            <main className="min-h-0 flex-1 overflow-hidden">
              <TaskHistory />
            </main>
          </div>

          {selectedAgentId && <ChatPanel key={selectedAgentId} />}
        </div>
      </div>
    </div>
  );
}
