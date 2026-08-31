import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ApiKeysUpdate } from "@/types/settings";

const API_KEYS_STATUS_KEY = ["api-keys-status"];

export function useApiKeysStatus() {
  return useQuery({
    queryKey: API_KEYS_STATUS_KEY,
    queryFn: api.settings.apiKeysStatus,
  });
}

export function useUpdateApiKeys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApiKeysUpdate) => api.settings.updateApiKeys(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: API_KEYS_STATUS_KEY }),
  });
}
