"use client";

import { ArrowDown, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { AutomationStep } from "../automation.types";

import AutomationTriggerRow from "../AutomationTriggerRow";
import AutomationActionRow from "../AutomationActionRow";

import type { AutomationActionType } from "../automation.actions";

import type {
  AutomationStatusColumn,
  AutomationTriggerType,
} from "../automation.trigger";

import type { AutomationGroup } from "../AutomationGroupPicker";
import AutomationCreateButton from "./AutomationCreateButton";
import { useParams } from "next/navigation";

type Props = {
  boardName: string;

  steps: AutomationStep[];

  statusColumns: AutomationStatusColumn[];

  groups: AutomationGroup[];

  onBack: () => void;

  onClose: () => void;

  onUpdateStep: (id: string, key: keyof AutomationStep, value: string) => void;

  onRemoveStep: (id: string) => void;

  onAddTrigger: () => void;

  onChangeTrigger: (trigger: AutomationTriggerType) => void;

  onAddAction: (action: AutomationActionType) => void;
};

export default function AutomationBuilder({
  steps,
  onBack,
  onUpdateStep,
  onRemoveStep,
  onAddTrigger,
  onChangeTrigger,
  onAddAction,
  statusColumns,
  groups,
}: Props) {
  /*
   * There is ONLY ONE trigger
   * and ONE action.
   */
  const trigger = steps.find((step) => step.type === "trigger");

  const action = steps.find((step) => step.type === "action");

  const hasTrigger = Boolean(trigger?.field);

  const hasAction = Boolean(action?.field);

  const params = useParams();

  const boardId = Number(params.boardId);
  const handleCreateAutomation = () => {
    if (!trigger || !action) {
      return;
    }

    console.log("=== CREATE AUTOMATION ===");

    console.log("Trigger:", {
      type: trigger.field,

      statusColumnId: trigger.columnId,

      selectedOption: trigger.value,
    });

    console.log("Action:", {
      type: action.field,

      selectedGroupId: action.field === "move" ? action.value : undefined,

      value: action.value,
    });

    console.log("Full automation:", {
      trigger,
      action,
    });
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}

      <div
        className="
          flex
          h-[48px]
          shrink-0
          items-center
          border-b
          px-4
        "
      >
        <button
          type="button"
          onClick={onBack}
          className="
            flex
            items-center
            gap-1.5
            text-[13px]
            text-slate-700
            hover:text-blue-600
          "
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Content */}

      <div className="flex flex-1 overflow-auto">
        <div
          className="
            mx-auto
            w-full
            max-w-[1100px]
            px-8
            py-[58px]
          "
        >
          {/* ------------------------------------------------------------ */}
          {/* Trigger                                                      */}
          {/* ------------------------------------------------------------ */}

          <div className="space-y-4">
            {trigger ? (
              <AutomationTriggerRow
                step={trigger}
                statusColumns={statusColumns}
                onUpdate={onUpdateStep}
                onRemove={onRemoveStep}
                onAdd={onAddTrigger}
                onChangeTrigger={onChangeTrigger}
              />
            ) : (
              <AutomationTriggerRow
                step={{
                  id: "empty-trigger",
                  type: "trigger",
                  field: "",
                  value: "",
                }}
                statusColumns={statusColumns}
                onUpdate={onUpdateStep}
                onRemove={() => {}}
                onAdd={onAddTrigger}
                onChangeTrigger={onChangeTrigger}
              />
            )}
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Connector                                                    */}
          {/* ------------------------------------------------------------ */}

          {hasTrigger && (
            <div
              className="
                relative
                ml-1.5
                h-[52px]
              "
            >
              <div
                className="
                  absolute
                  left-[-7px]
                  top-[18px]
                  flex
                  h-4
                  w-4
                  items-center
                  justify-center
                  rounded-full
                  bg-white
                "
              >
                <ArrowDown
                  className="
                    h-6
                    w-6
                    text-emerald-500
                  "
                />
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* Action                                                       */}
          {/* ------------------------------------------------------------ */}

          <div className="space-y-4">
            {action ? (
              <AutomationActionRow
                step={action}
                hasTrigger={hasTrigger}
                groups={groups}
                onUpdate={onUpdateStep}
                onRemove={onRemoveStep}
                onAdd={onAddAction}
              />
            ) : (
              <AutomationActionRow
                step={{
                  id: "empty-action",
                  type: "action",
                  field: "",
                  value: "",
                }}
                hasTrigger={hasTrigger}
                groups={groups}
                isPlaceholder
                onUpdate={onUpdateStep}
                onRemove={() => {}}
                onAdd={onAddAction}
              />
            )}
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Create                                                        */}
          {/* ------------------------------------------------------------ */}

          <div className="mt-10 flex items-center gap-3">
            {/* <Button
              disabled={
                !hasTrigger ||
                !hasAction
              }
              onClick={
                handleCreateAutomation
              }
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
              Create automation
            </Button> */}

            <AutomationCreateButton
              boardId={boardId}
              trigger={trigger}
              action={action}
              onSuccess={onBack}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
