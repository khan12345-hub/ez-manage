import type { AutomationStep } from "./automation.types";

export function automationToSteps(
  automation: any,
): AutomationStep[] {
  return [
    {
      id: `trigger-${automation.id}`,
      type: "trigger",
      field: "status",
      columnId: String(
        automation.triggerColumnId,
      ),
      value: String(
        automation.triggerStatusId,
      ),
    },

    {
      id: `action-${automation.id}`,
      type: "action",
      field: "move",
      value: String(
        automation.targetGroupId,
      ),
    },
  ];
}