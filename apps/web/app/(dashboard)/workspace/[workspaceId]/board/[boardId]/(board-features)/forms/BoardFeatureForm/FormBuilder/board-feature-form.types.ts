import { DateRange } from "react-day-picker";

export type FormFieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "STATUS"
  | "TIMELINE"
  | "CHECKBOX"
  | "LINK"
  | "FILE";

export interface FormFieldOption {
  id: string;
  label: string;
  color: string;
  isNew?: boolean;
}

export interface FormPage {
  id: string;
  title?: string;
}

export interface FormField {
  id: string;
  name: string;
  type: FormFieldType;
  /** Original board column type (e.g. "LONG_TEXT", "PERSON") for display logic */
  columnType?: string;

  columnId?: number;

  description?: string;
  placeholder?: string;

  required: boolean;
  hidden?: boolean;

  position?: number;
  /** Which page this field belongs to (0-indexed) */
  pageIndex?: number;

  options?: FormFieldOption[];

  date?: Date;
  timeline?: DateRange;
  checked?: boolean;
}

export interface FormBuilderState {
  name: string;
  description: string;
  groupId: number | null;
  submitLabel?: string;
  isActive?: boolean;
  fields: FormField[];
  pages: FormPage[];
  thankyouTitle?: string;
  thankyouMessage?: string;
}

export interface BoardFormStatusOption {
  id: number | string;
  label: string;
  color: string;
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
  statusOptions?: BoardFormStatusOption[];
  column?: {
    id: number;
    name: string;
    type: string;
    statusOptions?: BoardFormStatusOption[];
  };
}
