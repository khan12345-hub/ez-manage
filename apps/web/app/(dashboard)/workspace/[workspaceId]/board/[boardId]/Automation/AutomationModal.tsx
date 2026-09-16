"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { useParams } from "next/navigation";

import type { AutomationStep } from "./automation.types";
import AutomationGallery from "./AutomationGallery";
import AutomationBuilder from "./AutomationBuilder/AutomationBuilder";

import type { AutomationTriggerType } from "./automation.trigger";
import type { AutomationGroup } from "./AutomationGroupPicker";

import { useBoardAutomations } from "./useAutomations";

type AutomationModalProps = {
  open: boolean;

  onOpenChange: (open: boolean) => void;

  boardName?: string;

  columns: any[];

  groups: AutomationGroup[];
};

type AutomationView = "templates" | "builder";

export default function AutomationModal({
  open,
  onOpenChange,
  columns,
  boardName = "Testing board 2",
  groups,
}: AutomationModalProps) {
  const params = useParams();

  const boardId = Number(params.boardId);

  /*
   * ---------------------------------------------------------
   * View
   * ---------------------------------------------------------
   */

  const [view, setView] = useState<AutomationView>("templates");

  /*
   * ---------------------------------------------------------
   * Editing automation
   * ---------------------------------------------------------
   */

  const [editingAutomationId, setEditingAutomationId] = useState<number | null>(
    null,
  );

  /*
   * ---------------------------------------------------------
   * Automation steps
   * ---------------------------------------------------------
   */

  const [steps, setSteps] = useState<AutomationStep[]>([
    {
      id: "trigger-1",
      type: "trigger",
      field: "",
      value: "",
    },
    {
      id: "action-1",
      type: "action",
      field: "",
      value: "",
    },
  ]);

  /*
   * ---------------------------------------------------------
   * Existing automations
   * ---------------------------------------------------------
   */

  const { data: automations = [] } = useBoardAutomations(boardId);

  /*
   * ---------------------------------------------------------
   * Reset
   * ---------------------------------------------------------
   */

  const resetSteps = () => {
    setSteps([
      {
        id: "trigger-1",
        type: "trigger",
        field: "",
        value: "",
      },
      {
        id: "action-1",
        type: "action",
        field: "",
        value: "",
      },
    ]);
  };

  const reset = () => {
    setView("templates");

    setEditingAutomationId(null);

    resetSteps();
  };

  /*
   * ---------------------------------------------------------
   * Close
   * ---------------------------------------------------------
   */

  const handleClose = () => {
    onOpenChange(false);

    setTimeout(() => {
      reset();
    }, 200);
  };

  /*
   * ---------------------------------------------------------
   * Update step
   * ---------------------------------------------------------
   */

  const updateStep = (id: string, key: keyof AutomationStep, value: string) => {
    setSteps((current) =>
      current.map((step) =>
        step.id === id
          ? {
              ...step,
              [key]: value,
            }
          : step,
      ),
    );
  };

  /*
   * ---------------------------------------------------------
   * Remove step
   * ---------------------------------------------------------
   */

  const removeStep = (id: string) => {
    setSteps((current) =>
      current.map((step) => {
        if (step.id !== id) {
          return step;
        }

        return {
          ...step,
          field: "",
          value: "",
        };
      }),
    );
  };

  /*
   * ---------------------------------------------------------
   * Add trigger
   * ---------------------------------------------------------
   */

  const addTrigger = () => {
    setSteps((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "trigger",
        field: "",
        value: "",
      },
    ]);
  };

  /*
   * ---------------------------------------------------------
   * Add action
   * ---------------------------------------------------------
   */

  const addAction = (
    action:
      | "move"
      | "notify"
      | "change-status"
      | "create-subitem"
      | "set-date"
      | "send-email"
      | "assign",
  ) => {
    setSteps((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "action",
        field: action,
        value: "",
      },
    ]);
  };

  /*
   * ---------------------------------------------------------
   * Create from scratch
   * ---------------------------------------------------------
   */

  const createFromScratch = () => {
    setEditingAutomationId(null);

    setSteps([
      {
        id: crypto.randomUUID(),
        type: "trigger",
        field: "",
        value: "",
      },
      {
        id: crypto.randomUUID(),
        type: "action",
        field: "",
        value: "",
      },
    ]);

    setView("builder");
  };

  /*
   * ---------------------------------------------------------
   * Use template
   * ---------------------------------------------------------
   */

  const useTemplate = (templateId: string) => {
    setEditingAutomationId(null);

    switch (templateId) {
      case "status-move":
        setSteps([
          {
            id: crypto.randomUUID(),
            type: "trigger",
            field: "status",
            value: "",
          },
          {
            id: crypto.randomUUID(),
            type: "action",
            field: "move",
            value: "",
          },
        ]);

        break;

      case "assign-creator":
        setSteps([
          {
            id: crypto.randomUUID(),
            type: "trigger",
            field: "item-created",
            value: "",
          },
          {
            id: crypto.randomUUID(),
            type: "action",
            field: "assign-creator",
            value: "",
          },
        ]);

        break;

      case "date-notify":
        setSteps([
          {
            id: crypto.randomUUID(),
            type: "trigger",
            field: "date",
            value: "arrives",
          },
          {
            id: crypto.randomUUID(),
            type: "action",
            field: "notify",
            value: "",
          },
        ]);

        break;

      default:
        return;
    }

    setView("builder");
  };

  /*
   * ---------------------------------------------------------
   * Change trigger
   * ---------------------------------------------------------
   */

  const handleChangeTrigger = (trigger: AutomationTriggerType) => {
    setSteps((current) =>
      current.map((step) =>
        step.type === "trigger"
          ? {
              ...step,
              field: trigger,
              value: "",
            }
          : step,
      ),
    );
  };

  /*
   * ---------------------------------------------------------
   * Edit automation
   * ---------------------------------------------------------
   *
   * Convert the database automation into
   * the format expected by AutomationBuilder.
   */

  const handleEditAutomation = (automationId: number) => {
    const automation = automations.find((item) => item.id === automationId);

    if (!automation) {
      console.error("Automation not found:", automationId);

      return;
    }

    setEditingAutomationId(automationId);

    setSteps([
      {
        id: `trigger-${automation.id}`,
        type: "trigger",

        // This must match the value
        // expected by AutomationTriggerRow
        field: "status",

        // IMPORTANT:
        // Store both as strings because
        // your AutomationStep uses string values.
        columnId: String(automation.triggerColumnId),

        // StatusOption ID
        value: String(automation.triggerStatusId),
      },

      {
        id: `action-${automation.id}`,
        type: "action",
        field: "move",

        // Target group ID
        value: String(automation.targetGroupId),
      },
    ]);

    setView("builder");
  };

  /*
   * ---------------------------------------------------------
   * Status columns
   * ---------------------------------------------------------
   */

  const statusColumns = columns.filter(
    (column: any) => column.type === "STATUS",
  );

  const dateColumns = columns
    .filter((column: any) => column.type === "DATE" || column.type === "TIMELINE")
    .map((column: any) => ({ id: column.id, name: column.name, statusOptions: [] }));

  /*
   * ---------------------------------------------------------
   * Render
   * ---------------------------------------------------------
   */

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          handleClose();
        } else {
          onOpenChange(value);
        }
      }}
    >
      <DialogContent
        className="
          max-w-[calc(100vw-48px)]!
          h-[calc(100vh-24px)]
          gap-0
          overflow-hidden
          rounded-lg
          border
          bg-white
          p-0
        "
      >
        <DialogTitle className="sr-only">Board automations</DialogTitle>

        {view === "templates" ? (
          <AutomationGallery
            boardId={boardId}
            boardName={boardName}
            onClose={handleClose}
            onCreateFromScratch={createFromScratch}
            onUseTemplate={useTemplate}
            onEditAutomation={handleEditAutomation}
          />
        ) : (
          <AutomationBuilder
            boardName={boardName}
            steps={steps}
            statusColumns={statusColumns}
            dateColumns={dateColumns}
            groups={groups}
            automationId={editingAutomationId ?? undefined}
            onBack={() => {
              /*
               * Go back to the gallery.
               *
               * Manage tab will need to be selected
               * by the gallery if you want to return
               * directly to Manage.
               */
              setEditingAutomationId(null);

              setView("templates");
            }}
            onUpdateStep={updateStep}
            onRemoveStep={removeStep}
            onAddTrigger={addTrigger}
            onChangeTrigger={handleChangeTrigger}
            onAddAction={addAction}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
