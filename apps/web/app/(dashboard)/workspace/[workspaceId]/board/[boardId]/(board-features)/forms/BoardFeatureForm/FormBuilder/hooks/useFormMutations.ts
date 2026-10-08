"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  BoardColumnType,
  createColumn,
} from "@/services/columns.api";

import {
  createBoardForm,
  updateBoardForm,
  type CreateBoardFormPayload,
  type UpdateBoardFormPayload,
} from "@/services/board-form.api";

import { FormBuilderState } from "../board-feature-form.types";
import { encodePosition } from "../board-form.utils";
import { FormDesign } from "@/services/board-form.api";

export function useFormBuilderMutations(
  boardId: number,
  existingForm?: any,
) {
  const queryClient = useQueryClient();

  const createColumnMutation = useMutation({
    mutationFn: (payload: BoardColumnType) =>
      createColumn(boardId, payload),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ form, design }: { form: FormBuilderState; design?: FormDesign }) => {
      // Group fields by page to compute local positions
      const byPage = new Map<number, typeof form.fields>();
      for (const f of form.fields) {
        const pi = f.pageIndex ?? 0;
        if (!byPage.has(pi)) byPage.set(pi, []);
        byPage.get(pi)!.push(f);
      }

      const payload: CreateBoardFormPayload | UpdateBoardFormPayload = {
        groupId: Number(form.groupId),
        title: form.name || undefined,
        description: form.description || undefined,
        submitLabel: form.submitLabel || "Submit",
        isActive: form.isActive ?? true,
        ...(design !== undefined && { design }),
        fields: form.fields
          .filter((field) => field.columnId != null)
          .map((field) => {
            const pi = field.pageIndex ?? 0;
            const pageFields = byPage.get(pi) ?? [];
            const localIdx = Math.max(0, pageFields.findIndex((f) => f.id === field.id));

            const baseField = {
              columnId: field.columnId!,
              label: field.name,
              position: encodePosition(pi, localIdx),
              required: field.required,
              hidden: field.hidden ?? false,
            };

            if (field.type === "STATUS") {
              return {
                ...baseField,
                statusOptions: (field.options ?? []).map((option) => ({
                  id: option.id,
                  label: option.label,
                  color: option.color,
                })),
              };
            }

            return baseField;
          }),
      };

      if (existingForm) {
        return updateBoardForm(boardId, payload as UpdateBoardFormPayload);
      }
      return createBoardForm(boardId, payload as CreateBoardFormPayload);
    },

    onSuccess: (savedForm) => {
      queryClient.setQueryData(["board-form", boardId], savedForm);
      toast.success(existingForm ? "Form updated successfully" : "Form created successfully");
    },

    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to save form");
    },
  });

  return { createColumnMutation, saveMutation };
}
