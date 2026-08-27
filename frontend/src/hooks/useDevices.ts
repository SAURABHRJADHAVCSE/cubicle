import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

const DEVICES_KEY = ["devices"];

export function useDevices() {
  return useQuery({
    queryKey: DEVICES_KEY,
    queryFn: api.devices.list,
  });
}

export function useCreatePairingToken() {
  return useMutation({
    mutationFn: api.devices.pairingToken,
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.devices.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}
