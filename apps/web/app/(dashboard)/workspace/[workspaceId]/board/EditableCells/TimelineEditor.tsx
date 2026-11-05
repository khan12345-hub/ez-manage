"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { parseDateValue, toDateKey } from "@/lib/date-value";
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
  startDate?: Date | string;
  endDate?: Date | string;
}

export function TimelineEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<TimelineValue>) {
  const [open, setOpen] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>(
    () => ({
      from: value?.startDate
        ? parseDateValue(value.startDate) ?? undefined
        : undefined,

      to: value?.endDate
        ? parseDateValue(value.endDate) ?? undefined
        : undefined,
    }),
  );

  /*
   * Important:
   * Update the local range whenever the cell value changes.
   *
   * This is especially important after a bulk update because
   * the value coming from React Query/backend can change while
   * this component remains mounted.
   */
  useEffect(() => {
    setRange({
      from: value?.startDate
        ? parseDateValue(value.startDate) ?? undefined
        : undefined,

      to: value?.endDate
        ? parseDateValue(value.endDate) ?? undefined
        : undefined,
    });
  }, [value?.startDate, value?.endDate]);

  const handleSelect = (
    selectedRange: DateRange | undefined,
  ) => {
    setRange(selectedRange);

    // Wait until both dates are selected
    if (!selectedRange?.from || !selectedRange?.to) {
      return;
    }

    const newValue: TimelineValue = {
      // Plain "YYYY-MM-DD" — no timezone shift between users.
      startDate: toDateKey(selectedRange.from),
      endDate: toDateKey(selectedRange.to),
    };

    setValue(newValue);
    save(newValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={inputRef}
          variant="outline"
          className="w-full cursor-pointer justify-start text-left font-normal"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancel();
            }
          }}
        >
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

      <PopoverContent
        className="w-auto p-0"
        align="start"
      >
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