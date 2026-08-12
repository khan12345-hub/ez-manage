"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import {
  format,
  isBefore,
  isSameDay,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { DateRange } from "react-day-picker";

interface TimelinePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
}

export function TimelinePicker({
  value,
  onChange,
}: TimelinePickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      return;
    }

    // First click OR start a new range
    if (!value?.from || value.to) {
      onChange({
        from: date,
        to: undefined,
      });

      setOpen(true);
      return;
    }

    let from = value.from;
    let to = date;

    // User selected an earlier date.
    if (isBefore(to, from)) {
      [from, to] = [to, from];
    }

    // Same date clicked twice.
    if (isSameDay(from, to)) {
      onChange({
        from,
        to: undefined,
      });

      setOpen(true);
      return;
    }

    // Second click completes the range.
    onChange({
      from,
      to,
    });

    setOpen(false);
  };

  /*
   * Build the range used ONLY for visual highlighting.
   *
   * When the user has selected only the starting date,
   * we create a temporary one-day range so the selected
   * starting date is highlighted.
   */
  const highlightedRange: DateRange | undefined =
    value?.from
      ? {
          from: value.from,
          to: value.to ?? value.from,
        }
      : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />

          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "MMM d, yyyy")}
                {" → "}
                {format(value.to, "MMM d, yyyy")}
              </>
            ) : (
              <>
                {format(value.from, "MMM d, yyyy")}
                <span className="ml-1 text-muted-foreground">
                  → Select end date
                </span>
              </>
            )
          ) : (
            <span className="text-muted-foreground">
              Select timeline
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0"
        align="start"
      >
        <Calendar
          mode="single"
          selected={undefined}
          onSelect={handleSelect}
          numberOfMonths={2}
          
          modifiers={{
            range_start: highlightedRange?.from,
            range_end: highlightedRange?.to,
            range_middle:
              highlightedRange?.from &&
              highlightedRange?.to
                ? {
                    after: highlightedRange.from,
                    before: highlightedRange.to,
                  }
                : undefined,
          }}
          modifiersClassNames={{
            range_start:
              " text-primary-foreground rounded-l-md",
            range_end:
              " text-primary-foreground rounded-r-md",
            range_middle:
              "bg-primary/20 text-foreground rounded-none",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}