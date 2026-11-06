export interface StatusOption {
  id: number;
  label: string;
  color: string;
  order: number;
  isNew?: boolean;
  /** Status group (ClickUp-style). DONE = finished: never overdue anywhere. */
  category?: "NOT_STARTED" | "ACTIVE" | "DONE";
  /** User changed the category in the editor (send it on create). */
  categoryTouched?: boolean;
}

export interface StatusValue {
  label: string;
  color: string;
}

export type StatusEditorMode =
  | "picker"
  | "edit";

