export type FormFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "EMAIL"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "CHECKBOX";

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
}

export interface FormBuilderState {
  name: string;
  description: string;
  groupId: number | null;
  fields: FormField[];
}