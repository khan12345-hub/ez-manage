"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type {
  AutomationStatusOption,
} from "./automation.trigger";

type Props = {
  options: AutomationStatusOption[];

  value?: string;

  placeholder: string;

  disabled?: boolean;

  onSelect: (
    id: string | number,
  ) => void;
};

export default function AutomationStatusOptionPicker({
  options,
  value,
  placeholder,
  disabled = false,
  onSelect,
}: Props) {
  const selected =
    options.find(
      (option) =>
        String(option.id) ===
        String(value),
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`
            h-[38px]
            border-0
            border-b
            bg-transparent
            px-0
            text-[25px]
            outline-none

            ${
              disabled
                ? `
                  cursor-not-allowed
                  border-slate-300
                  text-slate-300
                `
                : `
                  border-slate-400
                  text-slate-400
                  hover:border-blue-500
                  hover:text-blue-500
                `
            }
          `}
        >
          {selected?.label ??
            placeholder}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[240px] p-1"
      >
        {options.length === 0 ? (
          <div
            className="
              px-3
              py-4
              text-sm
              text-slate-400
            "
          >
            No status options
            available
          </div>
        ) : (
          options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                onSelect(
                  option.id,
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
              {option.label}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}