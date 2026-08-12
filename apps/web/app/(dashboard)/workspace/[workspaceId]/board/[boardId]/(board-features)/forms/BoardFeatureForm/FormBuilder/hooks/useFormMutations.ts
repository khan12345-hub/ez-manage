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
    mutationFn: (payload: BoardColumnType) =>
      createColumn(boardId, payload),
  });

  /**
   * Creates or updates the board form when Save is clicked.
   */
  const saveMutation = useMutation({
    mutationFn: async ({
      form,
    }: {
      form: FormBuilderState;
    }) => {
      const payload:
        | CreateBoardFormPayload
        | UpdateBoardFormPayload = {
        groupId: Number(form.groupId),

        title: form.name || undefined,

        description:
          form.description || undefined,

        submitLabel:
          form.submitLabel || "Submit",

        isActive:
          form.isActive ?? true,

        fields: form.fields.map((field) => {
          const baseField = {
            columnId: field.columnId!,
            label: field.name,
            position: field.position ?? 0,
            required: field.required,
            hidden: field.hidden ?? false,
          };

          /**
           * Status fields additionally send their
           * configured status options.
           */
          if (field.type === "STATUS") {

      console.log("OPTIONS", field.options)

            return {
              ...baseField,

              statusOptions: (field.options ?? []).map(
                (option) => ({
                  id: option.id,
                  label: option.label,
                
                  color: option.color,
                }),
              ),
            };
          }

          return baseField;
        }),
      };


      console.log(
        "BOARD FORM API PAYLOAD:",
        JSON.stringify(payload, null, 2),
      );

      if (existingForm) {
        return updateBoardForm(
          boardId,
          payload as UpdateBoardFormPayload,
        );
      }

      return createBoardForm(
        boardId,
        payload as CreateBoardFormPayload,
      );
    },

    onSuccess: (savedForm) => {
      queryClient.setQueryData(
        ["board-form", boardId],
        savedForm,
      );

      toast.success(
        existingForm
          ? "Form updated successfully"
          : "Form created successfully",
      );
    },

    onError: (error: any) => {
      console.error(
        "Failed to save board form:",
        error,
      );

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

