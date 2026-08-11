
export type FormFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "STATUS"
  | "TIMELINE"
  | "CHECKBOX";

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
  color: string;
  isNew?: boolean;
}

export interface FormField {
  id: string;
  name: string;
  type: FormFieldType;

  columnId?: number;

  description?: string;
  placeholder?: string;

  required: boolean;
  hidden?: boolean;

  position?: number;

  options?: FormFieldOption[];
}

export interface FormBuilderState {
  name: string;
  description: string;
  groupId: number | null;
  fields: FormField[];
}

export interface BoardForm {
  id: number;
  viewId: number;
  groupId: number;

  title: string | null;
  description: string | null;
  submitLabel: string | null;
  isActive: boolean;

  fields: BoardFormField[];
}

export interface BoardFormField {
  id: number;
  formId?: number;
  columnId: number;

  label: string | null;
  description: string | null;

  position: number;

  required: boolean;
  hidden: boolean;

  column?: {
    id: number;
    name: string;
    type: string;
    statusOptions?: FormFieldOption[];
  };
}

