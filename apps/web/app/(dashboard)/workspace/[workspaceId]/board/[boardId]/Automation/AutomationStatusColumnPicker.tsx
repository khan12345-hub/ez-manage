"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type {
  AutomationStatusColumn,
} from "./automation.trigger";

type Props = {
  columns: AutomationStatusColumn[];

  value?: string;

  placeholder: string;

  onSelect: (
    id: string | number,
  ) => void;
};

export default function AutomationStatusColumnPicker({
  columns,
  value,
  placeholder,
  onSelect,
}: Props) {
  const selected =
    columns.find(
      (column) =>
        String(column.id) ===
        String(value),
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="
            h-[38px]
            border-0
            border-b
            border-slate-400
            bg-transparent
            px-0
            text-[25px]
            text-slate-400
            outline-none
            hover:border-blue-500
            hover:text-blue-500
          "
        >
          {selected?.name ??
            placeholder}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="
          w-[275px]
          p-1
        "
      >
        {columns.length === 0 ? (
          <div
            className="
              px-3
              py-4
              text-sm
              text-slate-400
            "
          >
            No status columns
            available
          </div>
        ) : (
          columns.map((column) => (
            <button
              key={column.id}
              type="button"
              onClick={() =>
                onSelect(
                  column.id,
                )
              }
              className="
                flex
                w-full
                rounded-md
                px-3
                py-2
                text-left
                text-sm
                text-slate-700
                hover:bg-slate-100
              "
            >
              {column.name}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}