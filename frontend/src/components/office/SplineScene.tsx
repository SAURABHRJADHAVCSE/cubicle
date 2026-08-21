"use client";

import type { Application } from "@splinetool/runtime";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

import { useAgents } from "@/hooks/useAgents";
import { getSocket } from "@/lib/socket";
import { splineObjectNameFor } from "@/lib/spline";
import type { AgentStatusEvent } from "@/types/events";

// @splinetool/runtime's WASM assets don't resolve through Turbopack's
// server/SSR bundling pass — load the canvas client-only.
const SplineCanvas = dynamic(() => import("@/components/office/SplineCanvas"), {
  ssr: false,
});

/** Ambient 3D office background — decoration, not navigation (cubicle_spec.md
 * design decision #2). Sidebar/dialogs remain the real interaction surface.
 * Socket.io connection itself is already wired app-wide by Providers'
 * SocketBridge — this component only adds its own agent_status listener.
 */
export function SplineScene() {
  const splineRef = useRef<Application | null>(null);
  const { data: agents } = useAgents();

  useEffect(() => {
    const socket = getSocket();

    const onAgentStatus = (payload: AgentStatusEvent) => {
      const app = splineRef.current;
      const agent = agents?.find((a) => a.id === payload.agent_id);
      if (!app || !agent || agent.desk_position == null) return;

      const objectName = splineObjectNameFor(agent.desk_position, payload.status as never);
      try {
        // "mouseDown" is the trigger type Spline's editor most commonly
        // wires custom-named object animations to; harmless no-op against
        // the placeholder scene, which has no object by this name.
        app.emitEvent("mouseDown", objectName);
      } catch {
        // Placeholder scene doesn't have this object — expected until a
        // real scene with matching names is wired in.
      }
    };

    socket.on("agent_status", onAgentStatus);
    return () => {
      socket.off("agent_status", onAgentStatus);
    };
  }, [agents]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-muted/30">
      <SplineCanvas
        onLoad={(app: Application) => {
          splineRef.current = app;
        }}
      />
    </div>
  );
}
