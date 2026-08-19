"use client";

import { Button } from "@/components/ui/button";

import type { AutomationStep } from "../automation.types";

import {
  useCreateAutomation,
  
  useUpdateAutomation,
} from "../useAutomations";
import { CreateAutomationPayload } from "@/services/automation.api";

type Props = {
  boardId: number;

  trigger?: AutomationStep;

  action?: AutomationStep;

  automationId?: number;

  onSuccess?: () => void;
};

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

  const hasTrigger = Boolean(trigger?.field);

  const hasAction = Boolean(action?.field);

  const canCreate =
    hasTrigger &&
    hasAction &&
    trigger?.field === "status" &&
    action?.field === "move" &&
    Boolean(trigger?.columnId) &&
    Boolean(trigger?.value) &&
    Boolean(action?.value);

  const handleSubmit = async () => {
    if (!canCreate) {
      return;
    }

    const payload: CreateAutomationPayload = {
      name: automationId
        ? "Status changed → Move to group"
        : "Status changed → Move to group",

      trigger: {
        type: "STATUS_CHANGED",
        columnId: Number(trigger.columnId),
        statusId: Number(trigger.value),
      },

      action: {
        type: "MOVE_TO_GROUP",
        groupId: Number(action.value),
      },
    };

    if (isEditing) {
      await updateMutation.mutateAsync({
        automationId: automationId!,
        data: payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }

    onSuccess?.();
  };

  return (
    <Button
      disabled={!canCreate || mutation.isPending}
      onClick={handleSubmit}
      className="
        ml-1
        h-[34px]
        rounded-md
        bg-blue-600
        px-4
        text-[13px]
        hover:bg-blue-700
      "
    >
      {mutation.isPending
        ? isEditing
          ? "Saving..."
          : "Creating..."
        : isEditing
          ? "Save changes"
          : "Create automation"}
    </Button>
  );
}
