import { getTaskActivities } from "@/services/activity-logs";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export function useTaskActivities(taskId: number, limit = 20) {
  return useInfiniteQuery({
    queryKey: ["task-activities", taskId, limit],
    queryFn: ({ pageParam }) => getTaskActivities(taskId, pageParam, limit),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    enabled: !!taskId,
  });
}
