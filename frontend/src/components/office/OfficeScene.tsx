"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { MoveVertical } from "lucide-react";

import { useAgents } from "@/hooks/useAgents";
import { cn } from "@/lib/utils";
import { TycoonHUD } from "@/components/office/TycoonHUD";

const OfficeCanvas = dynamic(
  () =>
    import("@/components/office/OfficeCanvas").then(
      (module) => module.OfficeCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 animate-pulse bg-[#eee8df]" />
    ),
  },
);

interface OfficeSceneProps {
  className?: string;
}

export function OfficeScene({ className }: OfficeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
        "relative isolate overflow-hidden border border-border bg-[#eee8df]",
        className,
      )}
    >
      <OfficeCanvas key={resetKey} onContextLost={handleContextLost} />

      <TycoonHUD
        agentsCount={agents?.length ?? 0}
        workingCount={workingCount}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {(agents?.length ?? 0) > 10 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/78 px-3 py-1.5 font-mono text-4xs font-bold uppercase tracking-[0.08em] text-white/72 shadow-lg backdrop-blur-md">
          <MoveVertical className="size-3" />
          Scroll or drag to explore
        </div>
      )}

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
