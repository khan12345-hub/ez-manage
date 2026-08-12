"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { BoardColumnType } from "@/services/columns.api";
import { getBoardForm } from "@/services/board-form.api";

import { FormField } from "./board-feature-form.types";
import { getDefaultLabel } from "./board-form.utils";
import { useFormBuilder } from "./hooks/useFormBuilder";
import { useFormBuilderMutations } from "./hooks/useFormMutations";

import { FormBuilderHeader } from "./FormBuilderHeader";
import { FormSettings } from "./FormSettings";
import { FormFieldsSection } from "./FormFieldsSection";
import { FormActions } from "./FormActions";
import { CopyFormLinkButton } from "../../CopyFormLinkButton";

interface FormBuilderProps {
  board: any;
}

export function FormBuilder({ board }: FormBuilderProps) {
  const boardId = board?.id;

  const { data: existingForm, isLoading } = useQuery({
    queryKey: ["board-form", boardId],

    queryFn: () => getBoardForm(boardId),

    enabled: Boolean(boardId),

    retry: false,
  });

  const {
    form,
    setName,
    setDescription,
    setGroupId,
    addField,
    updateField,
    removeField,
    reorderFields,
    setColumnId,
  } = useFormBuilder(board, existingForm);

  const { createColumnMutation, saveMutation } = useFormBuilderMutations(
    boardId,
    existingForm,
  );

  /**
   * Add a new form field and immediately
   * create its corresponding board column.
   */
  function handleAddField(type: FormField["type"]) {
    const field: FormField = {
      id: crypto.randomUUID(),

      name: getDefaultLabel(type),

      type,

      required: false,

      placeholder: "",

      columnId: undefined,

      position: form.fields.length,

      /**
       * STATUS fields always start with
       * an options array.
       */
      ...(type === "STATUS"
        ? {
            options: [],
          }
        : {}),
    };

    addField(field);

    createColumnMutation.mutate(type, {
      onSuccess: (column) => {
        setColumnId(field.id, column.id, column.name);
      },

      onError: () => {
        removeField(field.id);

        toast.error("Failed to create column");
      },
    });
  }

  /**
   * Validate the form and pass the complete
   * FormBuilderState to the mutation.
   *
   * Payload transformation happens inside
   * useFormBuilderMutations.
   */
  function handleSave() {
    if (!form.groupId) {
      toast.error("Please select a submission group");

      return;
    }

    if (form.fields.some((field) => !field.columnId)) {
      toast.error("Please wait for new columns to finish creating");

      return;
    }

    /**
     * Useful debugging before the payload
     * transformation happens.
     */
    console.log("FORM STATE BEFORE SAVE:", JSON.stringify(form, null, 2));

    saveMutation.mutate({
      form,
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border p-8 text-center">
          <p className="text-sm text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <FormBuilderHeader isEditing={Boolean(existingForm)} />
        <div className="flex items-center gap-2">
          <CopyFormLinkButton boardId={boardId} />
        </div>
      </div>

      <FormSettings
        name={form.name}
        description={form.description}
        groupId={form.groupId}
        groups={board?.groups ?? []}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onGroupChange={setGroupId}
      />

      <FormFieldsSection
        fields={form.fields}
        onAdd={handleAddField}
        onChange={updateField}
        onDelete={removeField}
        onReorder={reorderFields}
      />

      <FormActions
        isEditing={Boolean(existingForm)}
        isSaving={saveMutation.isPending}
        disabled={saveMutation.isPending || createColumnMutation.isPending}
        onSave={handleSave}
      />
    </div>
  );
}
