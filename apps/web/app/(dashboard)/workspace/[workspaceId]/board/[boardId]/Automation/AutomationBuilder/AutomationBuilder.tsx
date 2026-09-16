"use client";

import { ArrowDown, ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";

import type { AutomationStep } from "../automation.types";
import AutomationTriggerRow from "../AutomationTriggerRow";
import AutomationActionRow from "../AutomationActionRow";
import type { AutomationActionType } from "../automation.actions";
import type { AutomationStatusColumn, AutomationTriggerType } from "../automation.trigger";
import type { AutomationGroup } from "../AutomationGroupPicker";
import AutomationCreateButton from "./AutomationCreateButton";

type Props = {
  boardName: string;
  steps: AutomationStep[];
  statusColumns: AutomationStatusColumn[];
  dateColumns: AutomationStatusColumn[];
  groups: AutomationGroup[];
  automationId?: number;
  onBack: () => void;
  onClose?: () => void;
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
  dateColumns,
  groups,
  automationId,
}: Props) {
  const trigger = steps.find((s) => s.type === "trigger");
  const action  = steps.find((s) => s.type === "action");
  const hasTrigger = Boolean(trigger?.field);
  const params  = useParams();
  const boardId = Number(params.boardId);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex h-[48px] shrink-0 items-center border-b px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-slate-700 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1100px] px-8 py-[58px]">

          {/* Trigger */}
          <div className="space-y-4">
            {trigger ? (
              <AutomationTriggerRow
                step={trigger}
                statusColumns={statusColumns}
                dateColumns={dateColumns}
                onUpdate={onUpdateStep}
                onRemove={onRemoveStep}
                onAdd={onAddTrigger}
                onChangeTrigger={onChangeTrigger}
              />
            ) : (
              <AutomationTriggerRow
                step={{ id: "empty-trigger", type: "trigger", field: "", value: "" }}
                statusColumns={statusColumns}
                dateColumns={dateColumns}
                onUpdate={onUpdateStep}
                onRemove={() => {}}
                onAdd={onAddTrigger}
                onChangeTrigger={onChangeTrigger}
              />
            )}
          </div>

          {/* Connector */}
          {hasTrigger && (
            <div className="relative ml-1.5 h-[52px]">
              <div className="absolute left-[-7px] top-[18px] flex h-4 w-4 items-center justify-center rounded-full bg-white">
                <ArrowDown className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          )}

          {/* Action */}
          <div className="space-y-4">
            {action ? (
              <AutomationActionRow
                step={action}
                hasTrigger={hasTrigger}
                groups={groups}
                statusColumns={statusColumns}
                dateColumns={dateColumns}
                onUpdate={onUpdateStep}
                onRemove={onRemoveStep}
                onAdd={onAddAction}
              />
            ) : (
              <AutomationActionRow
                step={{ id: "empty-action", type: "action", field: "", value: "" }}
                hasTrigger={hasTrigger}
                groups={groups}
                statusColumns={statusColumns}
                dateColumns={dateColumns}
                isPlaceholder
                onUpdate={onUpdateStep}
                onRemove={() => {}}
                onAdd={onAddAction}
              />
            )}
          </div>

          {/* Save */}
          <div className="mt-10 flex items-center gap-3">
            <AutomationCreateButton
              boardId={boardId}
              trigger={trigger}
              action={action}
              automationId={automationId}
              onSuccess={onBack}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
