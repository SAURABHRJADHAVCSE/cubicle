"use client";

import { useEffect, useState } from "react";

import { getSocket } from "@/lib/socket";
import type { ChatToolCallFinishedEvent, ChatToolCallStartedEvent } from "@/types/events";

export interface DelegationEvent {
  taskId: string;
  targetAgentName: string;
  status: "in_progress" | "completed" | "failed";
}

/**
 * Live-tracks agents-as-tools delegation calls the currently-open agent
 * makes mid-chat (see backend/app/api/chat.py's chat_tool_call_started/
 * _finished emits) — lets ChatPanel show "Delegating to X…" inline while
 * the underlying Task runs. Mirrors useChatStream.ts's per-agentId
 * subscribe/reset pattern; cleared on chat_done since delegations belong
 * to the chat turn that triggered them.
 */
export function useDelegationEvents(agentId: string | null) {
  const [events, setEvents] = useState<DelegationEvent[]>([]);

  useEffect(() => {
    if (!agentId) return;
    const socket = getSocket();

    const onStarted = (payload: ChatToolCallStartedEvent) => {
      if (payload.agent_id !== agentId) return;
      setEvents((prev) => [
        ...prev,
        { taskId: payload.task_id, targetAgentName: payload.target_agent_name, status: "in_progress" },
      ]);
    };

    const onFinished = (payload: ChatToolCallFinishedEvent) => {
      if (payload.agent_id !== agentId) return;
      setEvents((prev) =>
        prev.map((event) =>
          event.taskId === payload.task_id
            ? { ...event, status: payload.status === "completed" ? "completed" : "failed" }
            : event,
        ),
      );
    };

    const onDone = (payload: { agent_id: string }) => {
      if (payload.agent_id !== agentId) return;
      setEvents([]);
    };

    socket.on("chat_tool_call_started", onStarted);
    socket.on("chat_tool_call_finished", onFinished);
    socket.on("chat_done", onDone);
    return () => {
      socket.off("chat_tool_call_started", onStarted);
      socket.off("chat_tool_call_finished", onFinished);
      socket.off("chat_done", onDone);
    };
  }, [agentId]);

  return events;
}
