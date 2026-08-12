"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { PublicBoardFormField } from "@/services/board-form.api";

import { FormFieldWrapper } from "./FormFieldWrapper";
import { FormDatePicker } from "./FormDatePicker";
import { FormTimelinePicker } from "./FormTimelinePicker";
import { FormStatusPicker } from "./FormStatusPicker";

interface TimelineValue {
  startDate?: string;
  endDate?: string;
}

interface PublicFormFieldRendererProps {
  field: PublicBoardFormField;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

const KNOWN_TYPES = [
  "TEXT",
  "NUMBER",
  "DATE",
  "TIMELINE",
  "STATUS",
  "CHECKBOX",
] as const;


export function PublicFormFieldRenderer({
  field,
  value,
  error,
  disabled = false,
  onChange,
}: PublicFormFieldRendererProps) {
  const type = field.column.type.toUpperCase() as (typeof KNOWN_TYPES)[number];
  const fieldId = `field-${field.id}`;
  const label = field.label ?? field.column.name;

  /* ---------- CHECKBOX (inline layout) ---------- */
  if (type === "CHECKBOX") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
        inline
      >
        <Checkbox
          id={fieldId}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
          className="mt-0.5"
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- TEXT ---------- */
  if (type === "TEXT") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <Textarea
          id={fieldId}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.column.name ?? "Enter text"}
          aria-invalid={Boolean(error)}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- NUMBER ---------- */
  if (type === "NUMBER") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <Input
          id={fieldId}
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          disabled={disabled}
          placeholder="Enter number"
          aria-invalid={Boolean(error)}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- DATE ---------- */
  if (type === "DATE") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <FormDatePicker
          id={fieldId}
          value={String(value ?? "")}
          onChange={(iso) => onChange(iso)}
          disabled={disabled}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- TIMELINE ---------- */
  if (type === "TIMELINE") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <FormTimelinePicker
          value={value as TimelineValue | undefined}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- STATUS ---------- */
  if (type === "STATUS") {
    return (
      <FormFieldWrapper
        id={fieldId}
        label={label}
        description={field.description}
        required={field.required}
        error={error}
      >
        <FormStatusPicker
          id={fieldId}
          options={field.column.statusOptions ?? []}
          value={value as string | undefined}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      </FormFieldWrapper>
    );
  }

  /* ---------- Unknown / fallback ---------- */
  return (
    <FormFieldWrapper
      id={fieldId}
      label={label}
      description={field.description}
      required={field.required}
      error={error}
    >
      <Input
        id={fieldId}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
    </FormFieldWrapper>
  );
}
