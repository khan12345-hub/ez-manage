import { bulkDeleteTasks, bulkUpdateTasks } from "@/services/tasks.api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

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

    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        toast.error("You don't have permission to delete one or more selected tasks.");
      } else {
        toast.error("Failed to delete tasks. Please try again.");
      }
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

    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        toast.error("You don't have permission to update one or more selected tasks.");
      } else {
        toast.error("Failed to update tasks. Please try again.");
      }
    },
  });

  return {
    bulkDelete: bulkDeleteMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,

    isDeleting: bulkDeleteMutation.isPending,
    isUpdating: bulkUpdateMutation.isPending,
  };
}