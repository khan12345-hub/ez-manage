export interface StatusOption {
  id: number;
  label: string;
  color: string;
  order: number;
  isNew?: boolean;
}

export interface StatusValue {
  label: string;
  color: string;
}

export type StatusEditorMode =
  | "picker"
  | "edit";

