"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, X } from "lucide-react";

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
  onChange?: (value: TimelineValue | null) => void;
}

export function TimelineBulkAction({
  disabled = false,
  onChange,
}: TimelineBulkActionProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setRange(selectedRange);
    if (!selectedRange?.from || !selectedRange?.to) return;
    onChange?.({ startDate: selectedRange.from, endDate: selectedRange.to });
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRange(undefined);
    onChange?.(null);
  };

  const label = range?.from
    ? range.to
      ? `${format(range.from, "dd MMM")} – ${format(range.to, "dd MMM yyyy")}`
      : format(range.from, "dd MMM yyyy")
    : "Pick a timeline";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="h-9 w-[240px] justify-start gap-2 font-normal"
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left">{label}</span>
          {range?.from && (
            <X
              className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start" side="top">
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