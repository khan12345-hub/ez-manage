import { bulkDeleteTasks, bulkUpdateTaskStatus } from "@/services/tasks.api";
import { useMutation, useQueryClient } from "@tanstack/react-query";



interface BulkStatusPayload {
  taskIds: number[];
  columnId: number;
  value: {
    label: string;
    color: string;
  };
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

  const bulkStatusMutation = useMutation({
    mutationFn: (payload: BulkStatusPayload) =>
      bulkUpdateTaskStatus(boardId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      onSuccess?.();
    },
  });

  return {
    bulkDelete: bulkDeleteMutation.mutate,
    bulkUpdateStatus: bulkStatusMutation.mutate,

    isDeleting: bulkDeleteMutation.isPending,
    isUpdating: bulkStatusMutation.isPending,
  };
}