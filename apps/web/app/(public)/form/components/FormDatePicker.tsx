"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FormDatePickerProps {
  id?: string;
  /** ISO date string (YYYY-MM-DD) or empty string */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Earliest selectable date */
  fromDate?: Date;
  /** Latest selectable date */
  toDate?: Date;
}

/**
 * Calendar popover date picker for public form fields.
 * Converts between ISO date strings and Date objects internally.
 */
export function FormDatePicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = "Pick a date",
  fromDate,
  toDate,
}: FormDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onChange("");
      setOpen(false);
      return;
    }

    // Format as YYYY-MM-DD to stay timezone-safe
    const iso = format(date, "yyyy-MM-dd");
    onChange(iso);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-12 w-full justify-start px-4 text-left text-base font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />

          {selected ? format(selected, "MMMM d, yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={(date) => {
            if (fromDate && date < fromDate) return true;
            if (toDate && date > toDate) return true;
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
