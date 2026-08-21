"use client";

import { useEffect, useRef, useState } from "react";

import { getSocket } from "@/lib/socket";

/**
 * Live-accumulates chat_chunk deltas for one agent's in-flight reply, and
 * clears once chat_done lands (the finished message arrives separately via
 * the conversations query, invalidated by useSendChatMessage's onSuccess).
 *
 * Callers should `key` their component by `agentId` so switching agents
 * remounts this hook's state fresh, rather than resetting it in an effect.
 */
export function useChatStream(agentId: string | null) {
  const [streamingText, setStreamingText] = useState("");
  const streamingRef = useRef("");

  useEffect(() => {
    if (!agentId) return;
    const socket = getSocket();

    const onChunk = (payload: { agent_id: string; delta: string }) => {
      if (payload.agent_id !== agentId) return;
      streamingRef.current += payload.delta;
      setStreamingText(streamingRef.current);
    };

    const onDone = (payload: { agent_id: string }) => {
      if (payload.agent_id !== agentId) return;
      streamingRef.current = "";
      setStreamingText("");
    };

    socket.on("chat_chunk", onChunk);
    socket.on("chat_done", onDone);
    return () => {
      socket.off("chat_chunk", onChunk);
      socket.off("chat_done", onDone);
    };
  }, [agentId]);

  return streamingText;
}
