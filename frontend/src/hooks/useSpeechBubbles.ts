"use client";

import { useEffect, useRef, useState } from "react";

import { useAgents } from "@/hooks/useAgents";
import { getSocket } from "@/lib/socket";
import type { AgentStatusEvent } from "@/types/events";

export interface SpeechBubbleState {
  id: string;
  agentName: string;
  accentColor: string;
  text: string;
}

const BUBBLE_LIFETIME_MS = 4000;

/**
 * Turns real agent_status transitions into short speech bubbles.
 *
 * cubicle_spec.md's speech bubbles are meant to come from a cheap-LLM
 * "social" dialogue system (Celery Beat scheduler + social/dialogue.py) —
 * that's V0.2 scope (social behavior scheduler, personality-driven
 * dialogue) and hasn't been built. These bubbles react to genuine status
 * changes with canned lines instead, so the UI element exists and works
 * against real events; swap in generated dialogue once V0.2's social
 * system lands.
 */
export function useSpeechBubbles(): SpeechBubbleState[] {
  const { data: agents } = useAgents();
  const [bubbles, setBubbles] = useState<SpeechBubbleState[]>([]);
  const previousStatus = useRef<Record<string, string>>({});

  useEffect(() => {
    const socket = getSocket();

    const onAgentStatus = (payload: AgentStatusEvent) => {
      const agent = agents?.find((a) => a.id === payload.agent_id);
      if (!agent) return;

      const prev = previousStatus.current[agent.id];
      previousStatus.current[agent.id] = payload.status;
      if (prev === payload.status) return;

      const text =
        payload.status === "working"
          ? "On it!"
          : prev === "working" && payload.status === "idle"
            ? "Done! 🎉"
            : null;
      if (!text) return;

      const bubble: SpeechBubbleState = {
        id: `${agent.id}-${Date.now()}`,
        agentName: agent.name,
        accentColor: agent.accent_color,
        text,
      };
      setBubbles((current) => [...current, bubble]);
      setTimeout(() => {
        setBubbles((current) => current.filter((b) => b.id !== bubble.id));
      }, BUBBLE_LIFETIME_MS);
    };

    socket.on("agent_status", onAgentStatus);
    return () => {
      socket.off("agent_status", onAgentStatus);
    };
  }, [agents]);

  return bubbles;
}
