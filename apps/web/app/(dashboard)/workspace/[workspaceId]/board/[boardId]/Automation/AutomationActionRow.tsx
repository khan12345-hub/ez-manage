"use client";

import { Trash2 } from "lucide-react";
import type { AutomationStep } from "./automation.types";
import type { AutomationActionType } from "./automation.actions";
import type { AutomationStatusColumn } from "./automation.trigger";
import AutomationActionPicker from "./AutomationActionPicker";
import AutomationGroupPicker from "./AutomationGroupPicker";
import type { AutomationGroup } from "./AutomationGroupPicker";
import AutomationStatusColumnPicker from "./AutomationStatusColumnPicker";
import AutomationStatusOptionPicker from "./AutomationStatusOptionPicker";

type Props = {
  step: AutomationStep;
  hasTrigger: boolean;
  isPlaceholder?: boolean;
  groups: AutomationGroup[];
  statusColumns: AutomationStatusColumn[];
  dateColumns: AutomationStatusColumn[];
  onUpdate: (id: string, key: keyof AutomationStep, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: (action: AutomationActionType) => void;
};

const valueClassName = `
  h-[38px]
  border-0
  border-b
  border-slate-400
  bg-transparent
  px-0
  text-[25px]
  text-slate-400
  outline-none
`;

export default function AutomationActionRow({
  step,
  hasTrigger,
  isPlaceholder = false,
  groups,
  statusColumns,
  dateColumns,
  onUpdate,
  onRemove,
  onAdd,
}: Props) {
  if (isPlaceholder) {
    return (
      <div className="flex items-center gap-2 text-[25px] leading-[34px] text-slate-700">
        <span>and then</span>
        <AutomationActionPicker disabled={!hasTrigger} placeholder="do this" onSelect={onAdd} />
      </div>
    );
  }

  const hasAction = Boolean(step.field);
  const selectedActionColumn = statusColumns.find(
    (col) => String(col.id) === String(step.columnId),
  );

  return (
    <div className="group flex items-center gap-2 text-[25px] leading-[34px] text-slate-700">
      <span>Then</span>

      {/* ── Move to group ──────────────────────────────────────────── */}
      {step.field === "move" && (
        <AutomationGroupPicker
          groups={groups}
          value={step.value}
          placeholder="move item to group"
          disabled={!hasTrigger}
          onSelect={(groupId) => onUpdate(step.id, "value", String(groupId))}
        />
      )}

      {/* ── Notify member ─────────────────────────────────────────── */}
      {step.field === "notify" && (
        <>
          <span className="text-slate-500">notify</span>
          <select
            value={step.value}
            onChange={(e) => onUpdate(step.id, "value", e.target.value)}
            className={valueClassName}
          >
            <option value="">select...</option>
            <option value="board-members">all board members</option>
            <option value="creator">the item creator</option>
          </select>
        </>
      )}

      {/* ── Change status ─────────────────────────────────────────── */}
      {step.field === "change-status" && (
        <>
          <span className="text-slate-500">change</span>
          <AutomationStatusColumnPicker
            columns={statusColumns}
            value={step.columnId ?? ""}
            placeholder="status column"
            onSelect={(colId) => {
              onUpdate(step.id, "columnId", String(colId));
              onUpdate(step.id, "value", "");
            }}
          />
          <span className="text-slate-500">to</span>
          <AutomationStatusOptionPicker
            options={selectedActionColumn?.statusOptions ?? []}
            value={step.value ?? ""}
            disabled={!selectedActionColumn}
            placeholder="status"
            onSelect={(optId) => onUpdate(step.id, "value", String(optId))}
          />
        </>
      )}

      {/* ── Create subitem ────────────────────────────────────────── */}
      {step.field === "create-subitem" && (
        <>
          <span className="text-slate-500">create subitem</span>
          <input
            type="text"
            value={step.value}
            placeholder="subitem name"
            onChange={(e) => onUpdate(step.id, "value", e.target.value)}
            className={valueClassName + " min-w-[180px]"}
          />
        </>
      )}

      {/* ── Set date ──────────────────────────────────────────────── */}
      {step.field === "set-date" && (
        <>
          <span className="text-slate-500">set</span>
          <AutomationStatusColumnPicker
            columns={dateColumns}
            value={step.columnId ?? ""}
            placeholder="date column"
            onSelect={(colId) => onUpdate(step.id, "columnId", String(colId))}
          />
          <span className="text-slate-500">to today</span>
        </>
      )}

      {/* ── Unknown / unselected action ────────────────────────────── */}
      {!["move","notify","change-status","create-subitem","set-date"].includes(step.field) && (
        <AutomationActionPicker
          disabled={!hasTrigger}
          placeholder={step.field || "choose action"}
          onSelect={(action) => {
            onUpdate(step.id, "field", action);
            onUpdate(step.id, "value", "");
            onUpdate(step.id, "columnId", "");
          }}
        />
      )}

      {/* Delete */}
      {hasAction && (
        <div className="ml-auto hidden items-center group-hover:flex">
          <button
            type="button"
            onClick={() => onRemove(step.id)}
            className="text-slate-500 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
