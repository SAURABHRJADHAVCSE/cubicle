import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AgentCreate, AgentUpdate } from "@/types/agent";

const AGENTS_KEY = ["agents"];

export function useAgents() {
  return useQuery({
    queryKey: AGENTS_KEY,
    queryFn: api.agents.list,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgentCreate) => api.agents.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENTS_KEY }),
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AgentUpdate }) =>
      api.agents.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENTS_KEY }),
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.agents.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENTS_KEY }),
  });
}

export function useAgentCollaborators(agentId: string | null) {
  return useQuery({
    queryKey: ["agent-collaborators", agentId],
    queryFn: () => api.agents.getCollaborators(agentId as string),
    enabled: !!agentId,
  });
}

export function useSetCollaborators() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, collaboratorIds }: { id: string; collaboratorIds: string[] }) =>
      api.agents.setCollaborators(id, collaboratorIds),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["agent-collaborators", variables.id] }),
  });
}
