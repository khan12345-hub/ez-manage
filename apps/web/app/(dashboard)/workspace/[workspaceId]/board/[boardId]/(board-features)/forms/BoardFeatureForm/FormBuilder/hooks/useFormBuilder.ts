"use client";

import { useEffect, useState } from "react";

import { FormBuilderState, FormField, FormPage } from "../board-feature-form.types";
import {
  createInitialForm,
  mergeFormWithBoardColumns,
} from "../board-form.utils";

export function useFormBuilder(board: any, existingForm?: any) {
  const [form, setForm] = useState<FormBuilderState>(() =>
    createInitialForm(board?.columns ?? []),
  );

  /** When an existing form loads, merge saved settings with current board columns */
  useEffect(() => {
    if (!existingForm) return;
    setForm(mergeFormWithBoardColumns(existingForm, board?.columns ?? []));
  }, [existingForm]); // eslint-disable-line react-hooks/exhaustive-deps

  function setName(name: string) {
    setForm((c) => ({ ...c, name }));
  }

  function setDescription(description: string) {
    setForm((c) => ({ ...c, description }));
  }

  function setGroupId(groupId: number | null) {
    setForm((c) => ({ ...c, groupId }));
  }

  function setSubmitLabel(submitLabel: string) {
    setForm((c) => ({ ...c, submitLabel }));
  }

  function setThankyou(title: string, message: string) {
    setForm((c) => ({ ...c, thankyouTitle: title, thankyouMessage: message }));
  }

  function addField(field: FormField) {
    setForm((c) => ({
      ...c,
      fields: [...c.fields, { ...field, position: c.fields.length }],
    }));
  }

  function updateField(updatedField: FormField) {
    setForm((c) => ({
      ...c,
      fields: c.fields.map((f) => (f.id === updatedField.id ? updatedField : f)),
    }));
  }

  function removeField(fieldId: string) {
    setForm((c) => ({
      ...c,
      fields: c.fields
        .filter((f) => f.id !== fieldId)
        .map((f, i) => ({ ...f, position: i })),
    }));
  }

  function toggleFieldHidden(fieldId: string) {
    setForm((c) => ({
      ...c,
      fields: c.fields.map((f) =>
        f.id === fieldId ? { ...f, hidden: !f.hidden } : f,
      ),
    }));
  }

  function toggleFieldRequired(fieldId: string) {
    setForm((c) => ({
      ...c,
      fields: c.fields.map((f) =>
        f.id === fieldId ? { ...f, required: !f.required } : f,
      ),
    }));
  }

  function reorderFields(fields: FormField[]) {
    setForm((c) => ({ ...c, fields }));
  }

  function setColumnId(fieldId: string, columnId: number, columnName?: string) {
    setForm((c) => ({
      ...c,
      fields: c.fields.map((f) =>
        f.id === fieldId
          ? { ...f, columnId, ...(columnName ? { name: columnName } : {}) }
          : f,
      ),
    }));
  }

  /* ── Page management ─────────────────────────────────────────── */

  function addPage() {
    setForm((c) => ({
      ...c,
      pages: [
        ...c.pages,
        { id: crypto.randomUUID(), title: `Page ${c.pages.length + 1}` },
      ],
    }));
  }

  function removePage(pageId: string) {
    setForm((c) => {
      const pageIndex = c.pages.findIndex((p) => p.id === pageId);
      if (pageIndex <= 0) return c; // Cannot remove the first page
      return {
        ...c,
        pages: c.pages.filter((p) => p.id !== pageId),
        // Move fields from the deleted page to the previous page; shift later pages down
        fields: c.fields.map((f) => {
          const fi = f.pageIndex ?? 0;
          if (fi === pageIndex) return { ...f, pageIndex: pageIndex - 1 };
          if (fi > pageIndex) return { ...f, pageIndex: fi - 1 };
          return f;
        }),
      };
    });
  }

  function updatePage(pageId: string, data: Partial<FormPage>) {
    setForm((c) => ({
      ...c,
      pages: c.pages.map((p) => (p.id === pageId ? { ...p, ...data } : p)),
    }));
  }

  return {
    form,
    setName,
    setDescription,
    setGroupId,
    setSubmitLabel,
    setThankyou,
    addField,
    updateField,
    removeField,
    toggleFieldHidden,
    toggleFieldRequired,
    reorderFields,
    setColumnId,
    addPage,
    removePage,
    updatePage,
  };
}
