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
  border-border
  bg-transparent
  px-0
  text-lg
  sm:text-[25px]
  text-muted-foreground
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-lg leading-snug text-foreground sm:text-[25px] sm:leading-[34px]">
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
    <div className="group flex flex-wrap items-center gap-x-2 gap-y-2 text-lg leading-snug text-foreground sm:text-[25px] sm:leading-[34px]">
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
          <span className="text-muted-foreground">notify</span>
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
          <span className="text-muted-foreground">change</span>
          <AutomationStatusColumnPicker
            columns={statusColumns}
            value={step.columnId ?? ""}
            placeholder="status column"
            onSelect={(colId) => {
              onUpdate(step.id, "columnId", String(colId));
              onUpdate(step.id, "value", "");
            }}
          />
          <span className="text-muted-foreground">to</span>
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
          <span className="text-muted-foreground">create subitem</span>
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
          <span className="text-muted-foreground">set</span>
          <AutomationStatusColumnPicker
            columns={dateColumns}
            value={step.columnId ?? ""}
            placeholder="date column"
            onSelect={(colId) => onUpdate(step.id, "columnId", String(colId))}
          />
          <span className="text-muted-foreground">to today</span>
        </>
      )}

      {/* ── Send WhatsApp ─────────────────────────────────────────── */}
      {step.field === "send-whatsapp" && (
        <>
          <span className="text-muted-foreground">send WhatsApp to</span>
          <select
            value={step.value}
            onChange={(e) => onUpdate(step.id, "value", e.target.value)}
            className={valueClassName}
          >
            <option value="">select...</option>
            <option value="board-members">all board members</option>
            <option value="creator">the item creator</option>
            <option value="assignees">the assignees</option>
          </select>
        </>
      )}

      {/* ── Unknown / unselected action ────────────────────────────── */}
      {!["move","notify","change-status","create-subitem","set-date","send-whatsapp"].includes(step.field) && (
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
            className="text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
