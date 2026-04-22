import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useOrg() {
  return useQuery({
    queryKey: queryKeys.org.all,
    queryFn: () => api.getOrg(),
  });
}

export function useEmployee(name: string | null) {
  return useQuery({
    queryKey: queryKeys.org.employee(name!),
    queryFn: () => api.getEmployee(name!),
    enabled: !!name,
  });
}

export function useDepartmentBoard(dept: string | null) {
  return useQuery({
    queryKey: queryKeys.org.board(dept!),
    queryFn: () => api.getDepartmentBoard(dept!),
    enabled: !!dept,
  });
}
