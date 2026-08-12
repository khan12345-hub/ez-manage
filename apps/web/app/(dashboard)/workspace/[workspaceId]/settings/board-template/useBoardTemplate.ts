"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBoardTemplate,
  deleteBoardTemplate,
  getBoardTemplates,
  updateBoardTemplate,
} from "@/services/board-template.api";

export function useBoardTemplates() {
  return useQuery({
    queryKey: ["board-templates"],
    queryFn: () => getBoardTemplates(),
    // enabled: Number.isInteger(workspaceId) && workspaceId > 0,
    retry:0
  });
}

export function useCreateBoardTemplate(
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: any) =>
      createBoardTemplate(payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-templates"],
      });
    },
  });
}

export function useUpdateBoardTemplate(
  workspaceId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: number;
      payload: any;
    }) =>
      updateBoardTemplate(
        templateId,
        payload,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-templates"],
      });
    },
  });
}

export function useDeleteBoardTemplate(
  workspaceId: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: number) =>
      deleteBoardTemplate(templateId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-templates", workspaceId],
      });
    },
  });
}