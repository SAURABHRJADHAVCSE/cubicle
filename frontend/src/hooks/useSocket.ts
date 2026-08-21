"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getSocket } from "@/lib/socket";

/**
 * Subscribes to Cubicle's real-time agent/task events and invalidates the
 * matching TanStack Query caches so the UI updates live, without every
 * component needing its own socket listener.
 */
export function useSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onAgentStatus = () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    };
    const onTaskStatus = () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };

    socket.on("agent_status", onAgentStatus);
    socket.on("task_status", onTaskStatus);

    return () => {
      socket.off("agent_status", onAgentStatus);
      socket.off("task_status", onTaskStatus);
    };
  }, [queryClient]);
}
