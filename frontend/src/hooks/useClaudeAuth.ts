import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

const CLAUDE_AUTH_STATUS_KEY = ["claude-auth-status"];

export function useClaudeAuthStatus() {
  return useQuery({
    queryKey: CLAUDE_AUTH_STATUS_KEY,
    queryFn: api.settings.claudeAuthStatus,
  });
}

export function useStartClaudeAuth() {
  return useMutation({
    mutationFn: api.settings.claudeAuthStart,
  });
}

export function useCompleteClaudeAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.settings.claudeAuthComplete(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAUDE_AUTH_STATUS_KEY }),
  });
}

export function useCancelClaudeAuth() {
  return useMutation({
    mutationFn: api.settings.claudeAuthCancel,
  });
}
