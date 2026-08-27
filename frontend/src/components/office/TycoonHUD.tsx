"use client";

import {
  Activity,
  Award,
  Cpu,
  Gamepad2,
  Maximize2,
  Minimize2,
  Server,
  Sparkles,
  UsersRound,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/agent";

export type CameraPreset =
  | "overview"
  | "reception"
  | "desks"
  | "servers"
  | "warroom"
  | "cafeteria"
  | "ceosuite"
  | "recroom";

export type SelectedObjectType =
  | { type: "server" }
  | { type: "cafeteria" }
  | { type: "recroom" }
  | { type: "ceosuite" }
  | { type: "warroom" }
  | { type: "reception" }
  | { type: "agent"; agent: Agent }
  | null;

const CAMERA_PRESETS: { id: CameraPreset; label: string; icon: typeof Sparkles }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "reception", label: "Reception", icon: Sparkles },
  { id: "desks", label: "Workstations", icon: Cpu },
  { id: "servers", label: "Server Core", icon: Server },
  { id: "ceosuite", label: "CEO Suite", icon: Award },
  { id: "cafeteria", label: "Cafeteria", icon: UtensilsCrossed },
  { id: "recroom", label: "Rec Arcade", icon: Gamepad2 },
  { id: "warroom", label: "War Room", icon: Activity },
];

interface TycoonHUDProps {
  agentsCount: number;
  workingCount: number;
  selectedObject: SelectedObjectType;
  onClearSelection: () => void;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  activePreset: CameraPreset;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function TycoonHUD({
  agentsCount,
  workingCount,
  selectedObject,
  onClearSelection,
  onSelectCameraPreset,
  activePreset,
  isFullscreen,
  onToggleFullscreen,
}: TycoonHUDProps) {
  const activeFloor = CAMERA_PRESETS.find((p) => p.id === activePreset) ?? CAMERA_PRESETS[0];
  const ActiveIcon = activeFloor.icon;

  return (
    <>
      {/* Top Status Bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-end p-3 gap-2 md:p-4">
        {/* Status Badges */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1.5 text-[11px] font-bold text-slate-200 backdrop-blur-xl shadow-lg">
            <UsersRound className="size-3.5 text-indigo-400" />
            {agentsCount} Agents
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1.5 text-[11px] font-bold text-slate-200 backdrop-blur-xl shadow-lg md:flex">
            <span className={`size-2 rounded-full ${workingCount ? "bg-indigo-400 shadow-[0_0_8px_#818cf8]" : "bg-emerald-400 shadow-[0_0_8px_#34d399]"}`} />
            {workingCount ? `${workingCount} Active` : "Settled"}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full border border-white/15 bg-slate-950/80 p-2 text-white shadow-xl hover:bg-slate-800 transition-all"
            onClick={onToggleFullscreen}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Bottom Camera Toolbar — collapsed to the active floor by default,
          expands on hover/focus so the 3D view keeps most of the screen. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center p-2">
        <div tabIndex={0} className="group pointer-events-auto relative outline-none">
          {/* Collapsed pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/85 px-4 py-1.5 text-[11px] font-bold text-white shadow-2xl backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0">
            <ActiveIcon className="size-3.5" />
            {activeFloor.label}
          </div>

          {/* Expanded floor picker */}
          <div className="pointer-events-none absolute bottom-0 left-1/2 flex max-w-[95vw] -translate-x-1/2 scale-95 items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-slate-950/85 p-1.5 text-white opacity-0 shadow-2xl backdrop-blur-xl transition-all duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100">
            {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onSelectCameraPreset(id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap ${
                  activePreset === id
                    ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Object Inspector Card */}
      {selectedObject && (
        <div className="pointer-events-auto absolute right-4 top-16 z-20 w-80 rounded-2xl border border-white/20 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="size-3.5" />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                {selectedObject.type === "reception" && "HQ Reception Lobby"}
                {selectedObject.type === "server" && "AI Data Server Core"}
                {selectedObject.type === "cafeteria" && "Cafeteria & Espresso Bar"}
                {selectedObject.type === "recroom" && "Arcade & Rec Lounge"}
                {selectedObject.type === "ceosuite" && "Executive CEO Suite"}
                {selectedObject.type === "warroom" && "War Room Strategy Hub"}
                {selectedObject.type === "agent" && `Agent: ${selectedObject.agent.name}`}
              </h3>
            </div>
            <button
              onClick={onClearSelection}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2.5 text-xs text-slate-300">
            {selectedObject.type === "server" && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Server Status:</span>
                  <span className="font-semibold text-emerald-400">99.99% Uptime</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Throughput:</span>
                  <span className="font-semibold text-sky-400">14,200 req/sec</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GPU Clusters:</span>
                  <span className="font-semibold text-indigo-400">8x H100 Nodes</span>
                </div>
              </>
            )}

            {selectedObject.type === "cafeteria" && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coffee Brewed Today:</span>
                  <span className="font-semibold text-amber-400">284 Cups</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Snack Machine Stock:</span>
                  <span className="font-semibold text-emerald-400">Full (100%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Morale Boost:</span>
                  <span className="font-semibold text-indigo-400">+25% Happiness</span>
                </div>
              </>
            )}

            {selectedObject.type === "recroom" && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Arcade Game:</span>
                  <span className="font-semibold text-purple-400">Cyber Tycoon 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">High Score:</span>
                  <span className="font-semibold text-amber-400">99,990 pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pool Table Match:</span>
                  <span className="font-semibold text-emerald-400">Tournament Ready</span>
                </div>
              </>
            )}

            {selectedObject.type === "ceosuite" && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Leadership Status:</span>
                  <span className="font-semibold text-amber-400">Strategic Vision</span>
                </div>
              </>
            )}

            {selectedObject.type === "warroom" && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Sprint:</span>
                  <span className="font-semibold text-indigo-400">Autonomous AI Loop</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Completed Deliverables:</span>
                  <span className="font-semibold text-emerald-400">142 Tasks</span>
                </div>
              </>
            )}

            {selectedObject.type === "agent" && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Role:</span>
                  <span className="font-semibold text-indigo-400">{selectedObject.agent.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-semibold uppercase text-emerald-400">{selectedObject.agent.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">System Model:</span>
                  <span className="font-semibold text-sky-400">
                    {selectedObject.agent.engine_model ?? selectedObject.agent.engine_provider}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
