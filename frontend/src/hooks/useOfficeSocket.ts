"use client";

import { useEffect } from "react";

import { getSocket } from "@/lib/socket";
import { useOfficeStore } from "@/stores/officeStore";
import type { AgentStatus } from "@/types/agent";
import type { AgentStatusEvent, CelebrationEvent } from "@/types/events";

/**
 * Feeds live `agent_status`/`celebration` events into officeStore, replacing
 * the scene→Spline event bridge that used to live inside SplineScene.tsx.
 * Kept separate from useSpeechBubbles' own listener, which derives a
 * different shape of state (transient transition text vs. persistent
 * per-agent 3D state) — net socket listener count is unchanged.
 */
export function useOfficeSocket(): void {
  useEffect(() => {
    const socket = getSocket();
    const setAgentStatus = useOfficeStore.getState().setAgentStatus;
    const triggerCelebration = useOfficeStore.getState().triggerCelebration;

    const onAgentStatus = (payload: AgentStatusEvent) => {
      setAgentStatus(payload.agent_id, payload.status as AgentStatus);
    };
    const onCelebration = (payload: CelebrationEvent) => {
      triggerCelebration(payload.agent_id);
    };

    socket.on("agent_status", onAgentStatus);
    socket.on("celebration", onCelebration);
    return () => {
      socket.off("agent_status", onAgentStatus);
      socket.off("celebration", onCelebration);
    };
  }, []);
}
