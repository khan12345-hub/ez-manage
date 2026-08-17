import {
  FormBuilderState,
  FormField,
  FormFieldType,
  BoardForm,
} from "./board-feature-form.types";

export function createInitialForm(columns: any[]): FormBuilderState {
  return {
    name: "",
    description: "",
    groupId: null,
    fields: mapBoardColumnsToFields(columns),
  };
}

export function mapBoardColumnsToFields(columns: any[]): FormField[] {
  return columns.map((column, index) => {
    const field: FormField = {
      id: crypto.randomUUID(),

      name: column.name,

      type: mapColumnTypeToFormType(column.type),

      required: false,

      placeholder: "",

      columnId: column.id,

      position: index,
    };

    if (column.type === "STATUS") {
      field.options = (column.statusOptions ?? []).map((option: any) => ({
        id: String(option.id),

        label: option.label,

        value: option.value ?? option.label?.toLowerCase().replace(/\s+/g, "-"),

        color: option.color ?? "#6366f1",

        isNew: false,
      }));
    }

    return field;
  });
}

export function mapColumnTypeToFormType(type: string): FormFieldType {
  switch (type) {
    case "TEXT":
      return "TEXT";

    case "NUMBER":
      return "NUMBER";

    case "DATE":
      return "DATE";

    case "STATUS":
      return "STATUS";

    case "CHECKBOX":
      return "CHECKBOX";

    default:
      return "TEXT";
  }
}

export function getDefaultLabel(type: FormFieldType): string {
  switch (type) {
    case "TEXT":
      return "Text";

    case "NUMBER":
      return "Number";

    case "DATE":
      return "Date";

    case "CHECKBOX":
      return "Checkbox";

    case "STATUS":
      return "Status";

    default:
      return "Label";
  }
}

export function mapExistingFormToState(form: BoardForm): FormBuilderState {
  return {
    name: form.title ?? "",

    description: form.description ?? "",

    groupId: form.groupId,

    fields: [...form.fields]
      .sort((a, b) => a.position - b.position)
      .map((field) => ({
        id: String(field.id),

        name: field.label ?? field.column?.name ?? "",

        type: mapColumnTypeToFormType(field.column?.type ?? "TEXT"),

        required: field.required,

        hidden: field.hidden,

        placeholder: "",

        columnId: field.columnId,

        description: field.description ?? "",

        position: field.position,

        options: field.column?.statusOptions?.map((option) => ({
          id: String(option.id),
          label: option.label,
          color: option.color ?? "#6366f1",
          isNew: false,
        })),
      })),
  };
}

export function buildFormPayload(form: FormBuilderState) {
  return {
    groupId: form.groupId!,

    title: form.name.trim() || undefined,

    description: form.description.trim() || undefined,

    submitLabel: "Submit",

    isActive: true,

    fields: form.fields.map((field, index) => ({
      columnId: field.columnId!,

      label: field.name.trim() || undefined,

      description: field.description?.trim() || undefined,

      position: index,

      required: field.required,

      hidden: field.hidden ?? false,
    })),
  };
}
