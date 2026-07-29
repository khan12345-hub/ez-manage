"use client";

import { Check, Pencil } from "lucide-react";

import { StatusOption, StatusValue } from "./status-options.types";

interface StatusPickerProps {
  statuses: StatusOption[];
  value: StatusValue | null;
  onSelect: (status: StatusOption) => void;
  onEdit: () => void;
}

export function StatusPicker({
  statuses,
  value,
  onSelect,
  onEdit,
}: StatusPickerProps) {
  return (
    <div className="space-y-2">
      {statuses.map((status) => {
        const isSelected =
          value?.label === status.label &&
          value?.color === status.color;

        return (
          <button
            key={status.id}
            type="button"
            onClick={() => onSelect(status)}
            className="relative flex h-10 w-full items-center justify-center rounded text-sm font-medium text-white transition hover:opacity-90"
            style={{
              background: status.color,
            }}
          >
            {status.label}

            {isSelected && (
              <Check className="absolute right-3 h-4 w-4" />
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
      >
        <Pencil className="h-4 w-4" />
        Edit Labels
      </button>
    </div>
  );
}

