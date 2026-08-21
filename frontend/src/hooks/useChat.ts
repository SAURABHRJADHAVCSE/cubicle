import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function conversationsKey(agentId: string) {
  return ["conversations", agentId];
}

export function useConversations(agentId: string | null) {
  return useQuery({
    queryKey: conversationsKey(agentId ?? ""),
    queryFn: () => api.chat.history(agentId as string),
    enabled: Boolean(agentId),
  });
}

export function useSendChatMessage(agentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => api.chat.send(agentId as string, { message }),
    onSuccess: () => {
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: conversationsKey(agentId) });
      }
    },
  });
}
