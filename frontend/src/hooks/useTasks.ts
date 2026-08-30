import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { TaskCreate, TaskUpdate } from "@/types/task";

const TASKS_KEY = ["tasks"];

export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: api.tasks.list,
    // No refetchInterval: useSocket() already invalidates this query on
    // every task_status event, so polling on top of that just doubles up
    // requests for no benefit. refetchOnWindowFocus is the only fallback
    // left, as a cheap safety net for the rare case a socket connection
    // silently dropped while the tab was in the background.
    refetchOnWindowFocus: true,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreate) => api.tasks.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useExecuteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.execute(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskUpdate }) =>
      api.tasks.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useTaskConfig() {
  return useQuery({
    queryKey: ["tasks", "config"],
    queryFn: api.tasks.config,
    // Server-side setting, effectively static for the app's lifetime — no
    // reason to refetch on every focus like the tasks list itself does.
    staleTime: Infinity,
  });
}
