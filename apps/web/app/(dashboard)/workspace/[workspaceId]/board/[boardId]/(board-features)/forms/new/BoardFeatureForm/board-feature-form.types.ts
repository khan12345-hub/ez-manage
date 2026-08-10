import { BoardColumnType } from "@/services/columns.api";
import type { DateRange } from "react-day-picker";

export type FormFieldType = Extract<
  BoardColumnType,
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "STATUS"
  | "CHECKBOX"
  | "TIMELINE"
>;

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
  color: string;
  isNew?:boolean;
}

export interface FormField {
  id: string;
  columnId?: number;
  name: string;
  placeholder?: string;
  type: FormFieldType;
  required: boolean;
  options?: FormFieldOption[];
  date?: Date;
  timeline?: DateRange;
}

export interface FormBuilderState {
  name: string;
  description: string;
  groupId: number | null;
  fields: FormField[];
}
