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
    // Same invalidate-and-refetch as onTaskStatus — a delete doesn't need
    // its own cache surgery, just needs *other* connected clients (not the
    // one that clicked delete, which already gets this via its own
    // mutation's onSuccess) to drop the task from their feed too.
    const onTaskDeleted = () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };

    socket.on("agent_status", onAgentStatus);
    socket.on("task_status", onTaskStatus);
    socket.on("task_deleted", onTaskDeleted);

    return () => {
      socket.off("agent_status", onAgentStatus);
      socket.off("task_status", onTaskStatus);
      socket.off("task_deleted", onTaskDeleted);
    };
  }, [queryClient]);
}
