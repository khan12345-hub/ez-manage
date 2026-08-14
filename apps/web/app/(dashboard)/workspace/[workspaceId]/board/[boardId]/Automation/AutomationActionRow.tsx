"use client";

import { Plus, Trash2 } from "lucide-react";

import type { AutomationStep } from "./automation.types";

type AutomationActionRowProps = {
  step: AutomationStep;
  onUpdate: (
    id: string,
    key: keyof AutomationStep,
    value: string,
  ) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
};

export default function AutomationActionRow({
  step,
  onUpdate,
  onRemove,
  onAdd,
}: AutomationActionRowProps) {
  return (
    <div className="group flex items-center gap-2 text-[25px] leading-[34px] text-slate-700">
      <span>Then</span>

      <select
        value={step.field || ""}
        onChange={(event) =>
          onUpdate(
            step.id,
            "field",
            event.target.value,
          )
        }
        className="
          h-[38px]
          appearance-none
          border-0
          border-b
          border-slate-400
          bg-transparent
          px-0
          text-[25px]
          text-slate-400
          outline-none
          focus:border-blue-500
        "
      >
        <option value="">notify someone</option>
        <option value="notify">
          notify someone
        </option>
        <option value="assign">
          assign someone
        </option>
        <option value="move">
          move item to group
        </option>
        <option value="change-status">
          change status
        </option>
      </select>

      {step.field === "notify" && (
        <select
          value={step.value || ""}
          onChange={(event) =>
            onUpdate(
              step.id,
              "value",
              event.target.value,
            )
          }
          className="
            h-[38px]
            appearance-none
            border-0
            border-b
            border-slate-400
            bg-transparent
            px-0
            text-[25px]
            text-slate-400
            outline-none
            focus:border-blue-500
          "
        >
          <option value="">someone</option>
          <option value="creator">
            the item creator
          </option>
          <option value="assignee">
            the assignee
          </option>
          <option value="board-members">
            board members
          </option>
        </select>
      )}

      <div
        className="
          ml-auto
          hidden
          items-center
          gap-4
          group-hover:flex
        "
      >
        <button
          onClick={onAdd}
          className="text-slate-500 hover:text-blue-600"
        >
          <Plus className="h-4 w-4" />
        </button>

        <button
          onClick={() => onRemove(step.id)}
          className="text-slate-500 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}