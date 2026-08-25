"use client";

import { Maximize2, Minimize2, Radio, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { SpeechBubbleOverlay } from "@/components/office/SpeechBubble";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";
import { useSpeechBubbles } from "@/hooks/useSpeechBubbles";
import { cn } from "@/lib/utils";

const OfficeCanvas = dynamic(
  () => import("@/components/office/OfficeCanvas").then((module) => module.OfficeCanvas),
  { ssr: false },
);

interface OfficeSceneProps {
  className?: string;
}

export function OfficeScene({ className }: OfficeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbles = useSpeechBubbles();
  const { data: agents } = useAgents();
  const [resetKey, setResetKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const workingCount =
    agents?.filter((agent) => ["working", "thinking"].includes(agent.status)).length ?? 0;

  const handleContextLost = useCallback(() => {
    setTimeout(() => setResetKey((key) => key + 1), 500);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  return (
    <section
      ref={containerRef}
      className={cn(
        "relative isolate overflow-hidden border border-slate-300 dark:border-white/10 bg-slate-900",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_18%,rgba(99,102,241,0.15),transparent_48%),linear-gradient(180deg,rgba(0,0,0,0)_50%,rgba(0,0,0,0.5)_100%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 md:p-4">
        <div className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-white shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Radio className="size-3.5 text-emerald-400 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">3D Office Floor</h2>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400 font-medium">Live simulation</p>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-xl shadow-md">
            <UsersRound className="size-3 text-indigo-400" />
            {agents?.length ?? 0} agents
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1.5 text-[10px] font-bold text-slate-200 backdrop-blur-xl shadow-md sm:flex">
            <span className={`size-1.5 rounded-full ${workingCount ? "bg-blue-400 shadow-[0_0_8px_#60a5fa]" : "bg-emerald-400 shadow-[0_0_8px_#34d399]"}`} />
            {workingCount ? `${workingCount} working` : "All settled"}
          </div>
        </div>
      </div>

      <OfficeCanvas key={resetKey} onContextLost={handleContextLost} />
      <SpeechBubbleOverlay bubbles={bubbles} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-3 text-slate-300 md:p-4">
        <div className="flex items-center gap-3 text-[9.5px] font-bold uppercase tracking-wider bg-slate-950/70 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-xl">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" /> Available
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="size-1.5 rounded-full bg-blue-400" /> Working
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="pointer-events-auto rounded-xl border border-white/15 bg-slate-950/80 p-2 text-white shadow-xl hover:bg-slate-800 transition-all"
          onClick={toggleFullscreen}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>

      {agents?.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="rounded-full border border-white/15 bg-slate-950/80 px-4 py-2 text-xs font-semibold text-slate-200 shadow-2xl backdrop-blur-xl">
            Add an agent to bring the office to life
          </p>
        </div>
      )}
    </section>
  );
}
