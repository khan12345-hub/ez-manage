"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type {
  AutomationTriggerType,
} from "./automation.trigger";

import {
  AUTOMATION_TRIGGER_TYPES,
} from "./automation.trigger";

type Props = {
  value?: string;

  onSelect: (
    value: AutomationTriggerType,
  ) => void;
};

export default function AutomationTriggerPicker({
  value,
  onSelect,
}: Props) {
  const selected =
    AUTOMATION_TRIGGER_TYPES.find(
      (item) =>
        item.value === value,
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
          {selected?.label ??
            "status"}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[240px] p-1"
      >
        {AUTOMATION_TRIGGER_TYPES.map(
          (trigger) => (
            <button
              key={trigger.value}
              type="button"
              onClick={() =>
                onSelect(
                  trigger.value,
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
                hover:bg-slate-100
              "
            >
              {trigger.label}
            </button>
          ),
        )}
      </PopoverContent>
    </Popover>
  );
}