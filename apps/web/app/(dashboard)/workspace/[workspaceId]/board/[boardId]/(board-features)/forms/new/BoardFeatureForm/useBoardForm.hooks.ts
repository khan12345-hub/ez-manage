"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createBoardForm,
  deleteBoardForm,
  getBoardForm,
  updateBoardForm,
  type CreateBoardFormPayload,
} from "@/services/board-form.api";

export const boardFormKeys = {
  all: ["board-forms"] as const,

  detail: (boardId: number, viewId: number) =>
    [...boardFormKeys.all, boardId, viewId] as const,
};

export function useBoardForm(
  boardId: number,
  viewId: number,
) {
  return useQuery({
    queryKey: boardFormKeys.detail(boardId, viewId),
    queryFn: () => getBoardForm(boardId, viewId),
    enabled: Boolean(boardId && viewId),
  });
}

export function useCreateBoardForm(
  boardId: number,
  viewId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBoardFormPayload) =>
      createBoardForm(boardId, viewId, payload),

    onSuccess: (form) => {
      queryClient.setQueryData(
        boardFormKeys.detail(boardId, viewId),
        form,
      );
    },
  });
}

export function useUpdateBoardForm(
  boardId: number,
  viewId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      payload: Partial<CreateBoardFormPayload>,
    ) =>
      updateBoardForm(
        boardId,
        viewId,
        payload,
      ),

    onSuccess: (form) => {
      queryClient.setQueryData(
        boardFormKeys.detail(boardId, viewId),
        form,
      );
    },
  });
}

export function useDeleteBoardForm(
  boardId: number,
  viewId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      deleteBoardForm(boardId, viewId),

    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: boardFormKeys.detail(
          boardId,
          viewId,
        ),
      });
    },
  });
}