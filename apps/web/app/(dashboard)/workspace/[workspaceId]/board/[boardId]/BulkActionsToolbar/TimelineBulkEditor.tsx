"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface TimelineValue {
  startDate: Date;
  endDate: Date;
}

interface TimelineBulkActionProps {
  column: {
    id: number;
    name: string;
  };
  disabled?: boolean;
  onChange?: (value: TimelineValue) => void;
}

export function TimelineBulkAction({
  disabled = false,
  onChange,
}: TimelineBulkActionProps) {
  const [open, setOpen] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>();

  const handleSelect = (
    selectedRange: DateRange | undefined,
  ) => {
    setRange(selectedRange);

    if (!selectedRange?.from || !selectedRange?.to) {
      return;
    }

    onChange?.({
      startDate: selectedRange.from,
      endDate: selectedRange.to,
    });

    // setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="h-9 w-[220px] justify-start text-left font-normal"
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