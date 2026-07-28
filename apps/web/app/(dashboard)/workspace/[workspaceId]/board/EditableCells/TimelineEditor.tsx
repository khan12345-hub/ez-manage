"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { CellEditorProps } from "./EditableCell";

export interface TimelineValue {
  startDate?: Date;
  endDate?: Date;
}

export function TimelineEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<TimelineValue>) {
  const [open, setOpen] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>({
    from: value?.startDate,
    to: value?.endDate,
  });

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setRange(selectedRange);

    // Wait until both dates are selected
    if (!selectedRange?.from || !selectedRange?.to) {
      return;
    }

    const newValue: TimelineValue = {
      startDate: selectedRange.from,
      endDate: selectedRange.to,
    };

    setValue(newValue);
    save(newValue);
    // setOpen(false);

  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={inputRef}
          variant="outline"
          className="w-full justify-start text-left font-normal cursor-pointer"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancel();
            }
          }}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />

          {range?.from ? (
            range.to ? (
              <>
                {format(range.from, "dd MMM yyyy")} -{" "}
                {format(range.to, "dd MMM yyyy")}
              </>
            ) : (
              format(range.from, "dd MMM yyyy")
            )
          ) : (
            "Pick a timeline"
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={2}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}