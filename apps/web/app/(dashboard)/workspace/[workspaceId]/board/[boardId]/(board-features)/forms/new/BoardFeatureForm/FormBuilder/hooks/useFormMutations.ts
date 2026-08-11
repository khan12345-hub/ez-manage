
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
} from "@/services/board-form.api";

import { FormBuilderState } from "../board-feature-form.types";

interface UseFormBuilderMutationsProps {
  boardId: number;
  existingForm?: any;
}

export function useFormBuilderMutations(
  boardId: number,
  existingForm?: any,
) {
  const queryClient = useQueryClient();

  /**
   * Creates a board column immediately when a
   * new field is added to the form.
   */
  const createColumnMutation = useMutation({
    mutationFn: (
      payload: BoardColumnType,
    ) => createColumn(boardId, payload),
  });

  /**
   * Creates or updates the form when Save is clicked.
   */
  const saveMutation = useMutation({
    mutationFn: async ({
      form,
    }: {
      form: FormBuilderState;
    }) => {
      const payload = {
        groupId: form.groupId!,
        title: form.name || undefined,
        description:
          form.description || undefined,
        submitLabel: "Submit",
        isActive: true,

        fields: form.fields.map(
          (field, index) => ({
            columnId: field.columnId!,
            label: field.name,
            position: index,
            required: field.required ?? false,
            hidden: false,
          }),
        ),
      };

      if (existingForm) {
        return updateBoardForm(
          boardId,
          payload,
        );
      }

      return createBoardForm(
        boardId,
        payload,
      );
    },

    onSuccess: (form) => {
      queryClient.setQueryData(
        ["board-form", boardId],
        form,
      );

      toast.success(
        existingForm
          ? "Form updated successfully"
          : "Form created successfully",
      );
    },

    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ||
          "Failed to save form",
      );
    },
  });

  return {
    createColumnMutation,
    saveMutation,
  };
}

