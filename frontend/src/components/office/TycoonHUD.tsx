"use client";

import { Maximize2, Minimize2, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TycoonHUDProps {
  agentsCount: number;
  workingCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function TycoonHUD({
  agentsCount,
  workingCount,
  isFullscreen,
  onToggleFullscreen,
}: TycoonHUDProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-2 p-3 md:p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/82 px-3 py-1.5 text-[10px] font-bold text-slate-100 shadow-lg backdrop-blur-xl">
          <UsersRound className="size-3.5 text-indigo-300" />
          {agentsCount} {agentsCount === 1 ? "agent" : "agents"}
        </div>
        <div className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/82 px-3 py-1.5 text-[10px] font-bold text-slate-100 shadow-lg backdrop-blur-xl sm:flex">
          <span
            className={`size-2 rounded-full ${
              workingCount
                ? "bg-indigo-400 shadow-[0_0_8px_#818cf8]"
                : "bg-emerald-400 shadow-[0_0_8px_#34d399]"
            }`}
          />
          {workingCount ? `${workingCount} working` : "Available"}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full border border-white/15 bg-slate-950/82 p-2 text-white shadow-lg transition-colors hover:bg-slate-800"
          onClick={onToggleFullscreen}
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
