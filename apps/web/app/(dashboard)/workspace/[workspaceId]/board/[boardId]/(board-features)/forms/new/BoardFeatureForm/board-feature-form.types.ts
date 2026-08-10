import type { DateRange } from "react-day-picker";

export type FormFieldType = any;

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
  color: string;
}

export interface FormField {
  id: string;
  label?: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string;
  columnId?: number;
  options?: FormFieldOption[];
  statusOptions?: any[];
  date?: Date;

  timeline?: DateRange;
}

export interface FormBuilderState {
  name: string;
  description: string;
  groupId: number | null;
  fields: FormField[];
}
