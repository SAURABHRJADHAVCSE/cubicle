import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useEngines() {
  return useQuery({
    queryKey: ["engines"],
    queryFn: api.engines.list,
  });
}
