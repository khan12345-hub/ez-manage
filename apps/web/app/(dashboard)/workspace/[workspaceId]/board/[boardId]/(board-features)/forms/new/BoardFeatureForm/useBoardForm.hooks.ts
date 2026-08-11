"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBoardForm,
  deleteBoardForm,
  getBoardForm,
  updateBoardForm,
  type CreateBoardFormPayload,
} from "@/services/board-form.api";

export const boardFormKeys = {
  all: ["board-forms"] as const,

  detail: (boardId: number) => [...boardFormKeys.all, boardId] as const,
};

export function useBoardForm(boardId: number) {
  return useQuery({
    queryKey: boardFormKeys.detail(boardId),

    queryFn: () => getBoardForm(boardId),

    enabled: Boolean(boardId),
  });
}

export function useCreateBoardForm(boardId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBoardFormPayload) =>
      createBoardForm(boardId, payload),

    onSuccess: (form) => {
      queryClient.setQueryData(boardFormKeys.detail(boardId), form);
    },
  });
}

export function useUpdateBoardForm(boardId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<CreateBoardFormPayload>) =>
      updateBoardForm(boardId, payload),

    onSuccess: (form) => {
      queryClient.setQueryData(boardFormKeys.detail(boardId), form);
    },
  });
}

export function useDeleteBoardForm(boardId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteBoardForm(boardId),

    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: boardFormKeys.detail(boardId),
      });
    },
  });
}
