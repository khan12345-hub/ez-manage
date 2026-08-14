export type AutomationStepType = "trigger" | "action";

export type AutomationStep = {
  id: string;
  type: AutomationStepType;
  field?: string;
  value?: string;
};

export type AutomationTemplate = {
  id: string;
  title: string;
  icon: string;
};