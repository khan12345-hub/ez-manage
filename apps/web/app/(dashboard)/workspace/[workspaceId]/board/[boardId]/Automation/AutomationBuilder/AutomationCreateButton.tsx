"use client";

import { Button } from "@/components/ui/button";

import type { AutomationStep } from "../automation.types";

import { useCreateAutomation } from "../useAutomations";

type Props = {
  boardId: number;
  trigger?: AutomationStep;
  action?: AutomationStep;
  onSuccess?: () => void;
};

export default function AutomationCreateButton({
  boardId,
  trigger,
  action,
  onSuccess,
}: Props) {
  const createMutation = useCreateAutomation(boardId);

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

  const handleCreate = async () => {
    if (!canCreate) {
      return;
    }

    await createMutation.mutateAsync({
      name: "Status changed → Move to group",

      trigger: {
        type: "STATUS_CHANGED",

        columnId: Number(trigger.columnId),

        statusId: Number(trigger.value),
      },

      action: {
        type: "MOVE_TO_GROUP",

        groupId: Number(action.value),
      },
    });

    onSuccess?.();
  };

  return (
    <Button
      disabled={!canCreate || createMutation.isPending}
      onClick={handleCreate}
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
      {createMutation.isPending ? "Creating..." : "Create automation"}
    </Button>
  );
}
