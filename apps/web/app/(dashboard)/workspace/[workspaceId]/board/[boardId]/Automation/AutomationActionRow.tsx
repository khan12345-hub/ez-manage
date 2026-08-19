"use client";

import { Trash2 } from "lucide-react";
import type { AutomationStep } from "./automation.types";
import type { AutomationActionType } from "./automation.actions";
import AutomationActionPicker from "./AutomationActionPicker";
import AutomationGroupPicker from "./AutomationGroupPicker";

import type { AutomationGroup } from "./AutomationGroupPicker";

type Props = {
  step: AutomationStep;

  hasTrigger: boolean;

  isPlaceholder?: boolean;

  groups: AutomationGroup[];

  onUpdate: (id: string, key: keyof AutomationStep, value: string) => void;

  onRemove: (id: string) => void;

  onAdd: (action: AutomationActionType) => void;
};

export default function AutomationActionRow({
  step,
  hasTrigger,
  isPlaceholder = false,
  groups,
  onUpdate,
  onRemove,
  onAdd,
}: Props) {
 function getActionLabel(field: string): string {
    const labels: Record<string, string> = {
      name: "Task name",
      description: "Description",
      status: "Status",
      priority: "Priority",
      assignee: "Assignee",
      dueDate: "Due date",
      startDate: "Start date",
      timeline: "Timeline",
      group: "Group",
      board: "Board",
      person: "Person",
      email: "Email",
      comment: "Comment",
      label: "Label",
    };

    return (
      labels[field] ??
      field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase())
    );
  }
  if (isPlaceholder) {
    return (
      <div
        className="
          flex
          items-center
          gap-2
          text-[25px]
          leading-[34px]
          text-slate-700
        "
      >
        <span>and then</span>

        <AutomationActionPicker
          disabled={!hasTrigger}
          placeholder="do this"
          onSelect={onAdd}
        />
      </div>
    );
  }

  const hasAction = Boolean(step.field);

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
      <span>Then</span>

      {/* Move action */}

      {step.field === "move" ? (
        <AutomationGroupPicker
          groups={groups}
          value={step.value}
          placeholder="move item to group"
          disabled={!hasTrigger}
          onSelect={(groupId) => {
            onUpdate(step.id, "value", String(groupId));

            console.log("Selected group:", {
              groupId,
            });
          }}
        />
      ) : (
        /* Normal action */

        <AutomationActionPicker
          disabled={!hasTrigger}
          placeholder={getActionLabel(step.field)}
          onSelect={(action) => {
            onUpdate(step.id, "field", action);

            onUpdate(step.id, "value", "");
          }}
        />
      )}

      {/* Action value */}

      {step.field !== "move" && <ActionValue step={step} onUpdate={onUpdate} />}

      {/* Delete */}

      {hasAction && (
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
            onClick={() => onRemove(step.id)}
            className="
              text-slate-500
              hover:text-red-500
            "
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ActionValue({
  step,
  onUpdate,
}: {
  step: AutomationStep;

  onUpdate: (id: string, key: keyof AutomationStep, value: string) => void;
}) {
  switch (step.field) {
    case "notify":
      return (
        <select
          value={step.value}
          onChange={(event) => onUpdate(step.id, "value", event.target.value)}
          className={valueClassName}
        >
          <option value="">someone</option>

          <option value="creator">the item creator</option>

          <option value="assignee">the assignee</option>

          <option value="board-members">board members</option>
        </select>
      );

    case "change-status":
      return <ValueButton>{step.value || "something"}</ValueButton>;

    case "assign":
      return <ValueButton>{step.value || "someone"}</ValueButton>;

    case "create-subitem":
      return <ValueButton>{step.value || "something"}</ValueButton>;

    case "set-date":
      return <ValueButton>{step.value || "a date"}</ValueButton>;

    case "send-email":
      return <ValueButton>{step.value || "someone"}</ValueButton>;

    default:
      return null;
  }
}

function ValueButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`
        ${valueClassName}
        hover:border-blue-500
        hover:text-blue-500
      `}
    >
      {children}
    </button>
  );
}

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
