"use client";

import { useEffect, useState } from "react";

import { getSocket } from "@/lib/socket";
import { useAgents } from "@/hooks/useAgents";
import type { SocialEvent } from "@/types/events";

export interface SpeechBubbleState {
  id: string;
  agentName: string;
  accentColor: string;
  text: string;
}

const BUBBLE_LIFETIME_MS = 4000;

/**
 * Speech bubbles are driven entirely by `social_event` now — real
 * LLM-generated dialogue from `app/social/dialogue.py`, covering
 * work-start/work-done lines today and (Phase 3) coffee/desk-visit/
 * wind-down lines from the Celery Beat scheduler.
 *
 * There used to be a second path here reacting directly to `agent_status`
 * transitions with canned "On it!"/"Done!" text. That's gone: the only
 * real agent-status transitions are idle↔working, and `social_event`'s
 * `work_chat` already covers exactly those two triggers (with real
 * dialogue, or its own canned fallback if the LLM call failed) — a
 * parallel `agent_status` listener would just double up the same moments,
 * not cover any additional case. (Note: a failed task also transitions the
 * agent back to `"idle"` — backend-wise there's no separate agent-level
 * "failed" status to distinguish from a normal completion.)
 */
export function useSpeechBubbles(): SpeechBubbleState[] {
  const { data: agents } = useAgents();
  const [bubbles, setBubbles] = useState<SpeechBubbleState[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const onSocialEvent = (payload: SocialEvent) => {
      const agent = agents?.find((a) => a.id === payload.agent_id);
      if (!agent) return;

      const bubble: SpeechBubbleState = {
        id: `${agent.id}-${Date.now()}`,
        agentName: agent.name,
        accentColor: agent.accent_color,
        text: payload.dialogue,
      };
      setBubbles((current) => [...current, bubble]);
      setTimeout(() => {
        setBubbles((current) => current.filter((b) => b.id !== bubble.id));
      }, BUBBLE_LIFETIME_MS);
    };

    socket.on("social_event", onSocialEvent);
    return () => {
      socket.off("social_event", onSocialEvent);
    };
  }, [agents]);

  return bubbles;
}
