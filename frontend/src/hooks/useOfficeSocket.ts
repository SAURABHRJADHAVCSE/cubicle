"use client";

import { useEffect } from "react";

import { getSocket } from "@/lib/socket";
import { useOfficeStore } from "@/stores/officeStore";
import type { AgentStatus } from "@/types/agent";
import type { AgentStatusEvent } from "@/types/events";

/**
 * Feeds live `agent_status` events into officeStore, replacing the
 * scene→Spline event bridge that used to live inside SplineScene.tsx.
 * Kept separate from useSpeechBubbles' own listener, which derives a
 * different shape of state (transient transition text vs. persistent
 * per-agent 3D state) — net socket listener count is unchanged.
 */
export function useOfficeSocket(): void {
  useEffect(() => {
    const socket = getSocket();
    const setAgentStatus = useOfficeStore.getState().setAgentStatus;

    const onAgentStatus = (payload: AgentStatusEvent) => {
      setAgentStatus(payload.agent_id, payload.status as AgentStatus);
    };

    socket.on("agent_status", onAgentStatus);
    return () => {
      socket.off("agent_status", onAgentStatus);
    };
  }, []);
}
