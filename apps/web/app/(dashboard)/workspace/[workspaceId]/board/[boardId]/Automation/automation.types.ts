export type AutomationStepType =
  | "trigger"
  | "action";

export type AutomationStep = {
  id: string;

  type: AutomationStepType;

  field: string;

  value: string;

  /**
   * Used by status triggers to store
   * the selected status column.
   */
  columnId?: string;
};