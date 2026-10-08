import {
  FormBuilderState,
  FormField,
  FormFieldType,
  FormPage,
  BoardForm,
} from "./board-feature-form.types";

/** Never included in the public form sidebar — system/internal columns */
export const SYSTEM_COLUMN_TYPES = new Set([
  "PERSON",
  "FILE_FEEDBACK",
  "CREATION_LOG",
]);

export function isSystemColumnType(type: string): boolean {
  return SYSTEM_COLUMN_TYPES.has(type);
}

export function mapColumnTypeToFormType(type: string): FormFieldType {
  switch (type) {
    case "TEXT":
      return "TEXT";
    case "LONG_TEXT":
      return "LONG_TEXT";
    case "NUMBER":
      return "NUMBER";
    case "DATE":
      return "DATE";
    case "TIMELINE":
      return "TIMELINE";
    case "STATUS":
    case "DROPDOWN":
    case "LABEL":
      return "STATUS";
    case "CHECKBOX":
      return "CHECKBOX";
    case "LINK":
      return "LINK";
    case "FILE":
      return "FILE";
    default:
      return "TEXT";
  }
}

export function getDefaultLabel(type: FormFieldType): string {
  switch (type) {
    case "TEXT": return "Text";
    case "LONG_TEXT": return "Long Text";
    case "NUMBER": return "Number";
    case "DATE": return "Date";
    case "CHECKBOX": return "Checkbox";
    case "STATUS": return "Status";
    case "TIMELINE": return "Timeline";
    case "LINK": return "Link";
    case "FILE": return "File";
    default: return "Field";
  }
}

/** Map a single board column to a FormField */
function columnToFormField(column: any, position: number): FormField {
  const field: FormField = {
    id: crypto.randomUUID(),
    name: column.name,
    type: mapColumnTypeToFormType(column.type),
    columnType: column.type,
    required: false,
    placeholder: "",
    columnId: column.id,
    position,
    hidden: isSystemColumnType(column.type),
  };

  if (column.type === "STATUS" || column.type === "DROPDOWN" || column.type === "LABEL") {
    field.options = (column.statusOptions ?? []).map((option: any) => ({
      id: String(option.id),
      label: option.label,
      value: option.value ?? option.label?.toLowerCase().replace(/\s+/g, "-"),
      color: option.color ?? "#6366f1",
      isNew: false,
    }));
  }

  return field;
}

export function mapBoardColumnsToFields(columns: any[]): FormField[] {
  return columns.map((column, index) => columnToFormField(column, index));
}

export function createInitialForm(columns: any[]): FormBuilderState {
  return {
    name: "",
    description: "",
    groupId: null,
    pages: [{ id: crypto.randomUUID(), title: "Page 1" }],
    fields: mapBoardColumnsToFields(columns),
  };
}

/** Encode pageIndex + within-page position into a single integer.
 *  page 0 → 0-999, page 1 → 1000-1999, etc.
 */
export function encodePosition(pageIndex: number, localIndex: number): number {
  return pageIndex * 1000 + localIndex;
}

/** Decode an encoded position back to { pageIndex, localIndex } */
export function decodePosition(encoded: number): { pageIndex: number; localIndex: number } {
  return { pageIndex: Math.floor(encoded / 1000), localIndex: encoded % 1000 };
}

/**
 * Merge an existing saved form with the board's current columns.
 * Saved field settings (hidden, required, position, label) are preserved.
 * Board columns not in the saved form are added as hidden at the end.
 */
export function mergeFormWithBoardColumns(existingForm: BoardForm, boardColumns: any[]): FormBuilderState {
  // Start from the saved form state
  const saved = mapExistingFormToState(existingForm);

  // Set of columnIds already in the saved form
  const savedColumnIds = new Set(saved.fields.map((f) => f.columnId));

  // Find board columns not yet in the form
  const missingColumns = boardColumns.filter(
    (col) => !savedColumnIds.has(col.id),
  );

  const missingFields: FormField[] = missingColumns.map((col, i) =>
    columnToFormField(col, saved.fields.length + i),
  );

  // Missing columns: force hidden, placed on page 0
  const withHidden = missingFields.map((f) => ({ ...f, hidden: true, pageIndex: 0 }));

  return {
    ...saved,
    fields: [...saved.fields, ...withHidden],
  };
}

export function mapExistingFormToState(form: BoardForm): FormBuilderState {
  const sortedFields = [...form.fields].sort((a, b) => a.position - b.position);

  const mappedFields = sortedFields.map((field) => {
    const { pageIndex } = decodePosition(field.position);
    return {
      id: String(field.id),
      name: field.label ?? field.column?.name ?? "",
      type: mapColumnTypeToFormType(field.column?.type ?? "TEXT"),
      columnType: field.column?.type,
      required: field.required,
      hidden: field.hidden,
      placeholder: "",
      columnId: field.columnId,
      description: field.description ?? "",
      position: field.position,
      pageIndex,
      options: field.column?.statusOptions?.map((option) => ({
        id: String(option.id),
        label: option.label,
        color: (option as any).color ?? "#6366f1",
        isNew: false,
      })),
    };
  });

  // Reconstruct pages array from the unique pageIndex values in fields
  const maxPageIndex = mappedFields.reduce((m, f) => Math.max(m, f.pageIndex ?? 0), 0);
  const pages: FormPage[] = Array.from(
    { length: maxPageIndex + 1 },
    (_, i) => ({ id: crypto.randomUUID(), title: `Page ${i + 1}` }),
  );

  return {
    name: form.title ?? "",
    description: form.description ?? "",
    groupId: form.groupId,
    submitLabel: form.submitLabel ?? "Submit",
    isActive: form.isActive,
    pages,
    fields: mappedFields,
  };
}

export function buildFormPayload(form: FormBuilderState) {
  // Group fields by page to compute local positions within each page
  const byPage = new Map<number, FormField[]>();
  for (const f of form.fields) {
    const pi = f.pageIndex ?? 0;
    if (!byPage.has(pi)) byPage.set(pi, []);
    byPage.get(pi)!.push(f);
  }

  return {
    groupId: form.groupId!,
    title: form.name.trim() || undefined,
    description: form.description.trim() || undefined,
    submitLabel: form.submitLabel || "Submit",
    isActive: form.isActive ?? true,
    fields: form.fields
      .filter((f) => f.columnId != null)
      .map((field) => {
        const pi = field.pageIndex ?? 0;
        const pageFields = byPage.get(pi) ?? [];
        const localIdx = pageFields.findIndex((f) => f.id === field.id);
        return {
          columnId: field.columnId!,
          label: field.name.trim() || undefined,
          description: field.description?.trim() || undefined,
          position: encodePosition(pi, Math.max(0, localIdx)),
          required: field.required,
          hidden: field.hidden ?? false,
        };
      }),
  };
}
