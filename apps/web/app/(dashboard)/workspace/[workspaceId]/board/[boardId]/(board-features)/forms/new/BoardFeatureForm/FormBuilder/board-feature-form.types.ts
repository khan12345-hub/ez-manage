import { DateRange } from "react-day-picker";

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

  /**
   * STATUS field options.
   */
  options?: FormFieldOption[];

  /**
   * DATE field value.
   *
   * Keep this flexible if DatePicker returns
   * either a Date or string.
   */
  date?: Date;

  /**
   * TIMELINE field value.
   */
  timeline?: DateRange;

  /**
   * CHECKBOX field value.
   */
  checked?: boolean;
}

export interface FormBuilderState {
  name: string;
  description: string;
  groupId: number | null;
  submitLabel?: string;
  isActive?: boolean;
  fields: FormField[];
}

/**
 * Status option returned by the API.
 */
export interface BoardFormStatusOption {
  id: number | string;
  label: string;
  color: string;
}

/**
 * Board form returned by the API.
 */
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
