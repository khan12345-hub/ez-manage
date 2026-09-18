"use client";

import { Button } from "@/components/ui/button";
import type { AutomationStep } from "../automation.types";
import { useCreateAutomation, useUpdateAutomation } from "../useAutomations";
import type { CreateAutomationPayload, TriggerPayload, ActionPayload } from "@/services/automation.api";

type Props = {
  boardId: number;
  trigger?: AutomationStep;
  action?: AutomationStep;
  automationId?: number;
  onSuccess?: () => void;
};

const TRIGGER_NAMES: Record<string, string> = {
  status:        "Status changed",
  "item-created": "Item created",
  date:          "Date arrived",
};

const ACTION_NAMES: Record<string, string> = {
  move:             "Move to group",
  notify:           "Notify member",
  "change-status":  "Change status",
  "create-subitem": "Create subitem",
  "set-date":       "Set date",
  "send-whatsapp":  "Send WhatsApp",
};

function buildTrigger(trigger: AutomationStep): TriggerPayload | null {
  if (trigger.field === "status") {
    if (!trigger.columnId || !trigger.value) return null;
    return { type: "STATUS_CHANGED", columnId: Number(trigger.columnId), statusId: Number(trigger.value) };
  }
  if (trigger.field === "item-created") {
    return { type: "TASK_CREATED" };
  }
  if (trigger.field === "date") {
    if (!trigger.columnId) return null;
    return { type: "DATE_ARRIVED", metadata: { dateColumnId: Number(trigger.columnId) } };
  }
  return null;
}

function buildAction(action: AutomationStep): ActionPayload | null {
  if (action.field === "move") {
    if (!action.value) return null;
    return { type: "MOVE_TO_GROUP", groupId: Number(action.value) };
  }
  if (action.field === "notify") {
    if (!action.value) return null;
    return { type: "NOTIFY_MEMBER", metadata: { target: action.value } };
  }
  if (action.field === "change-status") {
    if (!action.columnId || !action.value) return null;
    return { type: "CHANGE_STATUS", metadata: { columnId: Number(action.columnId), statusOptionId: Number(action.value) } };
  }
  if (action.field === "create-subitem") {
    if (!action.value) return null;
    return { type: "CREATE_SUBITEM", metadata: { name: action.value } };
  }
  if (action.field === "set-date") {
    if (!action.columnId) return null;
    return { type: "SET_DATE", metadata: { columnId: Number(action.columnId) } };
  }
  if (action.field === "send-whatsapp") {
    if (!action.value) return null;
    return { type: "SEND_WHATSAPP", metadata: { target: action.value } };
  }
  return null;
}

export default function AutomationCreateButton({
  boardId,
  trigger,
  action,
  automationId,
  onSuccess,
}: Props) {
  const createMutation = useCreateAutomation(boardId);
  const updateMutation = useUpdateAutomation(boardId);
  const isEditing = Boolean(automationId);
  const mutation = isEditing ? updateMutation : createMutation;

  const triggerPayload = trigger ? buildTrigger(trigger) : null;
  const actionPayload  = action  ? buildAction(action)   : null;
  const canCreate = Boolean(triggerPayload) && Boolean(actionPayload);

  const handleSubmit = async () => {
    if (!canCreate || !triggerPayload || !actionPayload || !trigger || !action) return;

    const name = `${TRIGGER_NAMES[trigger.field] ?? trigger.field} → ${ACTION_NAMES[action.field] ?? action.field}`;

    const payload: CreateAutomationPayload = { name, trigger: triggerPayload, action: actionPayload };

    if (isEditing) {
      await updateMutation.mutateAsync({ automationId: automationId!, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    onSuccess?.();
  };

  return (
    <Button
      disabled={!canCreate || mutation.isPending}
      onClick={handleSubmit}
      className="ml-1 h-[34px] rounded-md bg-blue-600 px-4 text-[13px] hover:bg-blue-700"
    >
      {mutation.isPending
        ? isEditing ? "Saving..." : "Creating..."
        : isEditing ? "Save changes" : "Create automation"}
    </Button>
  );
}
