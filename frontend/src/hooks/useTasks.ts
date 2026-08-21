import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { TaskCreate } from "@/types/task";

const TASKS_KEY = ["tasks"];

export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: api.tasks.list,
    // Tasks can be mid-execution; poll so completions show up without a
    // manual refresh even before the Socket.io event bridge is wired to
    // this hook specifically.
    refetchInterval: 4_000,
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
