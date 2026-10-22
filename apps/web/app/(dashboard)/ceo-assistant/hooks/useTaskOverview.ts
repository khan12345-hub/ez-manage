"use client";

import { useQuery } from "@tanstack/react-query";
import { getTaskOverview } from "@/services/ceo-assistant.api";

export function useTaskOverview(params: {
  inactivityDays: number;
  upcomingDays: number;
  workspaceIds?: number[];
}) {
  return useQuery({
    queryKey: ["ceo-task-overview", params],
    queryFn: () => getTaskOverview(params),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
}
