"use client";

import { useEffect, useState } from "react";

import { FormBuilderState, FormField } from "../board-feature-form.types";

import {
  createInitialForm,
  mapExistingFormToState,
} from "../board-form.utils";

export function useFormBuilder(board: any, existingForm?: any) {
  const [form, setForm] = useState<FormBuilderState>(() =>
    createInitialForm(board?.columns ?? []),
  );

  /**
   * Load saved form.
   */
  useEffect(() => {
    if (!existingForm) {
      return;
    }

    setForm(mapExistingFormToState(existingForm));
  }, [existingForm]);

  function setName(name: string) {
    setForm((current) => ({
      ...current,
      name,
    }));
  }

  function setDescription(description: string) {
    setForm((current) => ({
      ...current,
      description,
    }));
  }

  function setGroupId(groupId: number | null) {
    setForm((current) => ({
      ...current,
      groupId,
    }));
  }

  function addField(field: FormField) {
    setForm((current) => ({
      ...current,

      fields: [
        ...current.fields,
        {
          ...field,
          position: current.fields.length,
        },
      ],
    }));
  }

  function updateField(updatedField: FormField) {
    setForm((current) => ({
      ...current,

      fields: current.fields.map((field) =>
        field.id === updatedField.id ? updatedField : field,
      ),
    }));
  }

  function removeField(fieldId: string) {
    setForm((current) => ({
      ...current,

      fields: current.fields
        .filter((field) => field.id !== fieldId)
        .map((field, index) => ({
          ...field,
          position: index,
        })),
    }));
  }

  function reorderFields(fields: FormField[]) {
    setForm((current) => ({
      ...current,
      fields,
    }));
  }

  function setColumnId(fieldId: string, columnId: number, columnName?: string) {
    setForm((current) => ({
      ...current,

      fields: current.fields.map((field) =>
        field.id === fieldId
          ? {
              ...field,

              columnId,

              ...(columnName
                ? {
                    name: columnName,
                  }
                : {}),
            }
          : field,
      ),
    }));
  }

  return {
    form,

    setName,
    setDescription,
    setGroupId,

    addField,
    updateField,
    removeField,
    reorderFields,
    setColumnId,
  };
}
