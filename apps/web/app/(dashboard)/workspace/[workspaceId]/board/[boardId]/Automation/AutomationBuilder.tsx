"use client";

import { ArrowDown, ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutomationStep } from "./automation.types";
import AutomationTriggerRow from "./AutomationTriggerRow";
import AutomationActionRow from "./AutomationActionRow";

type AutomationBuilderProps = {
  boardName: string;
  steps: AutomationStep[];
  onBack: () => void;
  onClose: () => void;
  onUpdateStep: (
    id: string,
    key: keyof AutomationStep,
    value: string,
  ) => void;
  onRemoveStep: (id: string) => void;
  onAddTrigger: () => void;
  onAddAction: () => void;
};

export default function AutomationBuilder({
  steps,
  onBack,
  onClose,
  onUpdateStep,
  onRemoveStep,
  onAddTrigger,
  onAddAction,
}: AutomationBuilderProps) {
  const triggerSteps = steps.filter(
    (step) => step.type === "trigger",
  );

  const actionSteps = steps.filter(
    (step) => step.type === "action",
  );

  const hasTrigger = triggerSteps.some(
    (step) => step.field,
  );

  const hasAction = actionSteps.some(
    (step) => step.field,
  );

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex h-[48px] shrink-0 items-center border-b px-4">
        <button
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
        <div className="mx-auto w-full max-w-[1100px] px-8 py-[58px]">
          {/* Triggers */}
          <div className="space-y-4">
            {triggerSteps.map((step) => (
              <AutomationTriggerRow
                key={step.id}
                step={step}
                onUpdate={onUpdateStep}
                onRemove={onRemoveStep}
                onAdd={onAddTrigger}
              />
            ))}
          </div>

          {/* Connector */}
          {triggerSteps.length > 0 &&
            actionSteps.length > 0 && (
              <div className="relative ml-1.5 h-[52px]">
                <div className="absolute left-[-7px] top-[18px] flex h-4 w-4 items-center justify-center rounded-full bg-white">
                  <ArrowDown className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            )}

          {/* Actions */}
          <div className="space-y-4">
            {actionSteps.map((step) => (
              <AutomationActionRow
                key={step.id}
                step={step}
                onUpdate={onUpdateStep}
                onRemove={onRemoveStep}
                onAdd={onAddAction}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-10 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onAddTrigger}
              title="Add trigger"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onAddAction}
              title="Add action"
            >
              <Plus className="h-4 w-4" />
            </Button>

            <Button
              disabled={!hasTrigger || !hasAction}
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
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}