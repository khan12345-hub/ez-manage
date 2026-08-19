"use client";

import { Trash2 } from "lucide-react";

import type { AutomationStep } from "./automation.types";

import type {
  AutomationStatusColumn,
  AutomationTriggerType,
} from "./automation.trigger";

import AutomationTriggerPicker from "./AutomationTriggerPicker";
import AutomationStatusColumnPicker from "./AutomationStatusColumnPicker";
import AutomationStatusOptionPicker from "./AutomationStatusOptionPicker";

type AutomationTriggerRowProps = {
  step: AutomationStep;

  statusColumns: AutomationStatusColumn[];

  onUpdate: (
    id: string,
    key: keyof AutomationStep,
    value: string,
  ) => void;

  onRemove: (id: string) => void;

  onAdd: () => void;

  onChangeTrigger: (
    trigger: AutomationTriggerType,
  ) => void;
};

export default function AutomationTriggerRow({
  step,
  statusColumns,
  onUpdate,
  onRemove,
  onChangeTrigger,
}: AutomationTriggerRowProps) {
  /*
   * Find the currently selected status column.
   *
   * String conversion is intentional because
   * AutomationStep stores IDs as strings while
   * Prisma IDs are numbers.
   */
  const selectedColumn = statusColumns.find(
    (column) =>
      String(column.id) === String(step.columnId),
  );

  return (
    <div
      className="
        group
        flex
        items-center
        gap-2
        text-[25px]
        leading-[34px]
        text-slate-700
      "
    >
      <span>When</span>

      {step.field === "status" ? (
        <>
          {/* Status column */}
          <AutomationStatusColumnPicker
            columns={statusColumns}
            value={step.columnId ?? ""}
            placeholder="status"
            onSelect={(columnId) => {
              /*
               * Set trigger type.
               */
              onUpdate(
                step.id,
                "field",
                "status",
              );

              /*
               * Set selected status column.
               */
              onUpdate(
                step.id,
                "columnId",
                String(columnId),
              );

              /*
               * Changing the column invalidates
               * the previously selected status.
               */
              onUpdate(
                step.id,
                "value",
                "",
              );

              onChangeTrigger("status");
            }}
          />

          <span>changes to</span>

          {/* Status option */}
          <AutomationStatusOptionPicker
            options={
              selectedColumn?.statusOptions ?? []
            }
            value={step.value ?? ""}
            disabled={!selectedColumn}
            placeholder="something"
            onSelect={(optionId) => {
              onUpdate(
                step.id,
                "value",
                String(optionId),
              );
            }}
          />
        </>
      ) : (
        <AutomationTriggerPicker
          value={step.field}
          onSelect={(trigger) => {
            onUpdate(
              step.id,
              "field",
              trigger,
            );

            /*
             * Clear status-specific values when
             * changing to another trigger type.
             */
            onUpdate(
              step.id,
              "columnId",
              "",
            );

            onUpdate(
              step.id,
              "value",
              "",
            );

            onChangeTrigger(trigger);
          }}
        />
      )}

      {/* Delete */}
      <div
        className="
          ml-auto
          hidden
          items-center
          group-hover:flex
        "
      >
        <button
          type="button"
          onClick={() =>
            onRemove(step.id)
          }
          className="
            text-slate-500
            transition-colors
            hover:text-red-500
          "
          aria-label="Remove trigger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}