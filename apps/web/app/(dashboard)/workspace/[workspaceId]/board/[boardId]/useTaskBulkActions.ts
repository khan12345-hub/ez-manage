import { bulkDeleteTasks, bulkUpdateTasks, bulkMoveTasks, bulkDuplicateTasks } from "@/services/tasks.api";
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

    onSuccess: (_data, taskIds) => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-tasks", boardId] });
      toast.success(`${taskIds.length} task${taskIds.length !== 1 ? "s" : ""} deleted.`);
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

    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-tasks", boardId] });
      toast.success(`${payload.taskIds.length} task${payload.taskIds.length !== 1 ? "s" : ""} updated.`);
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

  const bulkMoveMutation = useMutation({
    mutationFn: ({ taskIds, targetGroupId }: { taskIds: number[]; targetGroupId: number }) =>
      bulkMoveTasks(boardId, taskIds, targetGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-tasks", boardId] });
      toast.success("Tasks moved successfully.");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message ?? "Failed to move tasks.");
      } else {
        toast.error("Failed to move tasks. Please try again.");
      }
    },
  });

  const bulkDuplicateMutation = useMutation({
    mutationFn: ({ taskIds, withUpdates }: { taskIds: number[]; withUpdates: boolean }) =>
      bulkDuplicateTasks(boardId, taskIds, withUpdates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-tasks", boardId] });
      toast.success("Tasks duplicated successfully.");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message ?? "Failed to duplicate tasks.");
      } else {
        toast.error("Failed to duplicate tasks. Please try again.");
      }
    },
  });

  return {
    bulkDelete: bulkDeleteMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,
    bulkMove: bulkMoveMutation.mutate,
    bulkDuplicate: bulkDuplicateMutation.mutate,

    isDeleting: bulkDeleteMutation.isPending,
    isUpdating: bulkUpdateMutation.isPending,
    isMoving: bulkMoveMutation.isPending,
    isDuplicating: bulkDuplicateMutation.isPending,
  };
}