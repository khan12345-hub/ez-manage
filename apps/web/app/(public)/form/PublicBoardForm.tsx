"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  getPublicBoardForm,
  submitBoardForm,
  type PublicBoardForm as PublicBoardFormData,
  type SubmitBoardFormPayload,
} from "@/services/board-form.api";

import { PublicFormFieldRenderer } from "./components/PublicFormFieldRenderer";

interface PublicBoardFormProps {
  boardId: number;
}

type FormValues = Record<number, unknown>;

export function PublicBoardForm({ boardId }: PublicBoardFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  /* ── Fetch form definition ── */
  const {
    data: form,
    isLoading,
    isError,
  } = useQuery<PublicBoardFormData>({
    queryKey: ["public-board-form", boardId],
    queryFn: () => getPublicBoardForm(boardId),
    enabled: Boolean(boardId),
    retry: false,
  });

  /* ── Submit mutation ── */
  const { mutate: submit, isPending: isSubmitting } = useMutation({
    mutationFn: (payload: SubmitBoardFormPayload) =>
      submitBoardForm(boardId, payload),
    onSuccess: () => {
      router.push("/form/thank-you");
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  /* ── Derived visible fields ── */
  const visibleFields = useMemo(() => {
    if (!form?.fields) return [];

    return [...form.fields]
      .filter((field) => !field.hidden)
      .sort((a, b) => a.position - b.position);
  }, [form?.fields]);

  /* ── Helpers ── */
  function setFieldValue(fieldId: number, value: unknown) {
    setValues((current) => ({ ...current, [fieldId]: value }));

    // Clear error on change
    setErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }

  function validate(): boolean {
    const nextErrors: Record<number, string> = {};

    visibleFields.forEach((field) => {
      if (!field.required) return;

      const value = values[field.id];
      const type = field.column.type.toUpperCase();

      let isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      // TIMELINE: require both dates when field is required
      if (type === "TIMELINE" && !isEmpty) {
        const tv = value as { startDate?: string; endDate?: string };
        if (!tv.startDate || !tv.endDate) {
          nextErrors[field.id] = "Both start and end dates are required";
          return;
        }
      }

      if (isEmpty) {
        nextErrors[field.id] = "This field is required";
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) return;

    const primaryField = visibleFields.find((field) => field.column.isPrimary);
    const taskName = primaryField
      ? String(values[primaryField.id] ?? "").trim()
      : "";

    const payload: SubmitBoardFormPayload = {
      ...(taskName ? { taskName } : {}),
      values: visibleFields
        .filter((f) => values[f.id] !== undefined && values[f.id] !== "")
        .map((f) => ({ columnId: f.columnId, value: values[f.id] })),
    };

    submit(payload);
  }

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border p-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />

          <p className="mt-3 text-sm text-muted-foreground">Loading form…</p>
        </div>
      </div>
    );
  }

  /* ── Error / not found state ── */
  if (isError || !form) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border p-8 text-center">
          <h1 className="text-lg font-semibold">Form not found</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            This form does not exist or is unavailable.
          </p>
        </div>
      </div>
    );
  }

  /* ── Inactive state ── */
  if (!form.isActive) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border p-8 text-center">
          <h1 className="text-lg font-semibold">Form unavailable</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            This form is currently inactive.
          </p>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {form.title || "Submit Form"}
        </h1>

        {form.description && (
          <p className="text-sm text-muted-foreground">{form.description}</p>
        )}
      </div>

      {/* Fields */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {visibleFields.map((field) => (
          <PublicFormFieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            error={errors[field.id]}
            disabled={isSubmitting}
            onChange={(val) => setFieldValue(field.id, val)}
          />
        ))}

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}

          {form.submitLabel || "Submit"}
        </Button>
      </form>
    </div>
  );
}
