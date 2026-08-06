import { bulkDeleteTasks, bulkUpdateTasks } from "@/services/tasks.api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface BulkUpdateTaskPayload {
  taskIds: number[];
  columnId: number;
  value: any;
}

export function useTaskBulkActions(
  boardId: number,
  onSuccess?: () => void,
) {
  const queryClient = useQueryClient();

  const bulkDeleteMutation = useMutation({
    mutationFn: (taskIds: number[]) =>
      bulkDeleteTasks(boardId, taskIds),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      onSuccess?.();
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (payload: BulkUpdateTaskPayload) =>
      bulkUpdateTasks(boardId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      onSuccess?.();
    },
  });

  return {
    bulkDelete: bulkDeleteMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,

    isDeleting: bulkDeleteMutation.isPending,
    isUpdating: bulkUpdateMutation.isPending,
  };
}