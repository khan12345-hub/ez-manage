"use client";

import { Trash2 } from "lucide-react";
import type { AutomationStep } from "./automation.types";
import type { AutomationStatusColumn, AutomationTriggerType } from "./automation.trigger";
import AutomationTriggerPicker from "./AutomationTriggerPicker";
import AutomationStatusColumnPicker from "./AutomationStatusColumnPicker";
import AutomationStatusOptionPicker from "./AutomationStatusOptionPicker";

type AutomationTriggerRowProps = {
  step: AutomationStep;
  statusColumns: AutomationStatusColumn[];
  dateColumns: AutomationStatusColumn[];
  onUpdate: (id: string, key: keyof AutomationStep, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onChangeTrigger: (trigger: AutomationTriggerType) => void;
};

export default function AutomationTriggerRow({
  step,
  statusColumns,
  dateColumns,
  onUpdate,
  onRemove,
  onChangeTrigger,
}: AutomationTriggerRowProps) {
  const selectedStatusColumn = statusColumns.find(
    (col) => String(col.id) === String(step.columnId),
  );

  const rowCls = "group flex items-center gap-2 text-[25px] leading-[34px] text-slate-700";

  return (
    <div className={rowCls}>
      <span>When</span>

      {/* ── Status trigger ─────────────────────────────────────────── */}
      {step.field === "status" && (
        <>
          <AutomationStatusColumnPicker
            columns={statusColumns}
            value={step.columnId ?? ""}
            placeholder="status"
            onSelect={(columnId) => {
              onUpdate(step.id, "field", "status");
              onUpdate(step.id, "columnId", String(columnId));
              onUpdate(step.id, "value", "");
              onChangeTrigger("status");
            }}
          />
          <span>changes to</span>
          <AutomationStatusOptionPicker
            options={selectedStatusColumn?.statusOptions ?? []}
            value={step.value ?? ""}
            disabled={!selectedStatusColumn}
            placeholder="something"
            onSelect={(optionId) => onUpdate(step.id, "value", String(optionId))}
          />
        </>
      )}

      {/* ── Item-created trigger ───────────────────────────────────── */}
      {step.field === "item-created" && (
        <>
          <AutomationTriggerPicker
            value={step.field}
            onSelect={(trigger) => {
              onUpdate(step.id, "field", trigger);
              onUpdate(step.id, "columnId", "");
              onUpdate(step.id, "value", "");
              onChangeTrigger(trigger);
            }}
          />
          {/* No extra config needed — trigger is self-contained */}
        </>
      )}

      {/* ── Date trigger ──────────────────────────────────────────── */}
      {step.field === "date" && (
        <>
          <AutomationStatusColumnPicker
            columns={dateColumns}
            value={step.columnId ?? ""}
            placeholder="date column"
            onSelect={(columnId) => {
              onUpdate(step.id, "columnId", String(columnId));
              onChangeTrigger("date");
            }}
          />
          <span>arrives</span>
        </>
      )}

      {/* ── No trigger selected yet ────────────────────────────────── */}
      {!step.field && (
        <AutomationTriggerPicker
          value={step.field}
          onSelect={(trigger) => {
            onUpdate(step.id, "field", trigger);
            onUpdate(step.id, "columnId", "");
            onUpdate(step.id, "value", "");
            onChangeTrigger(trigger);
          }}
        />
      )}

      {/* Delete */}
      <div className="ml-auto hidden items-center group-hover:flex">
        <button
          type="button"
          onClick={() => onRemove(step.id)}
          className="text-slate-500 transition-colors hover:text-red-500"
          aria-label="Remove trigger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
