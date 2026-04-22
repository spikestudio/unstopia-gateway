import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useSkills() {
  return useQuery({
    queryKey: queryKeys.skills.all,
    queryFn: () => api.getSkills(),
  });
}

export function useSkill(name: string | null) {
  return useQuery({
    queryKey: queryKeys.skills.detail(name ?? ""),
    queryFn: () => api.getSkill(name ?? ""),
    enabled: !!name,
  });
}
