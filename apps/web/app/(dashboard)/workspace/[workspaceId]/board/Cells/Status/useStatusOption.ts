
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createStatusOption,
  deleteStatusOption,
  updateStatusOption,
  CreateStatusOptionPayload,
  UpdateStatusOptionPayload,
} from "@/services/status-options.api";

export function useStatusOptions(
  boardId?: number,
) {
  const queryClient = useQueryClient();

  const invalidateBoard = async () => {
    if (!boardId) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["board", boardId],
    });
  };

  const createMutation = useMutation({
    mutationFn: ({
      columnId,
      payload,
    }: {
      columnId: number;
      payload: CreateStatusOptionPayload;
    }) =>
      createStatusOption(
        columnId,
        payload,
      ),

    onSuccess: invalidateBoard,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      columnId,
      statusId,
      payload,
    }: {
      columnId: number;
      statusId: number;
      payload: UpdateStatusOptionPayload;
    }) =>
      updateStatusOption(
        columnId,
        statusId,
        payload,
      ),

    onSuccess: invalidateBoard,
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      columnId,
      statusId,
    }: {
      columnId: number;
      statusId: number;
    }) =>
      deleteStatusOption(
        columnId,
        statusId,
      ),

    onSuccess: invalidateBoard,
  });

  return {
    createStatusOption: createMutation.mutateAsync,
    updateStatusOption: updateMutation.mutateAsync,
    deleteStatusOption: deleteMutation.mutateAsync,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
  };
}

