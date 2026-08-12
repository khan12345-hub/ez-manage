"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createBoardTemplate,
  updateBoardTemplate,
  deleteBoardTemplate,
} from "@/services/board-template.api";

import { CreateTemplatePayload } from "./template.types";

export function useCreateBoardTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) =>
      createBoardTemplate(payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-templates"],
      });
    },
  });
}

export function useUpdateBoardTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: number;
      payload: Partial<CreateTemplatePayload>;
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

export function useDeleteBoardTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: number) =>
      deleteBoardTemplate(templateId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board-templates"],
      });
    },
  });
}