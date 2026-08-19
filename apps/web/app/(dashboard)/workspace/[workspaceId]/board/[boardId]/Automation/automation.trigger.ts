export type AutomationTriggerType =
  | "status"
  | "item-created"
  | "date";

export type AutomationStatusOption = {
  id: string | number;

  label: string;
};

export type AutomationStatusColumn = {
  id: string | number;

  name: string;

  statusOptions: AutomationStatusOption[];
};

export const AUTOMATION_TRIGGER_TYPES = [
  {
    value: "status",
    label: "status",
  },
  {
    value: "item-created",
    label: "item is created",
  },
  {
    value: "date",
    label: "date",
  },
] as const;