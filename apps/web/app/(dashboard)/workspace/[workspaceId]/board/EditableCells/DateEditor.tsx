"use client";

import { format, isValid } from "date-fns";
import { AlertCircle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { CellEditorProps } from "./EditableCell";

export interface DateValue {
  date?: Date | string;
}

export function DateEditor({
  editing,
  inputRef,
  value,
  setValue,
  save,
  cancel,
  column,
}: CellEditorProps<DateValue>) {
  const raw = value?.date;
  // Parse "YYYY-MM-DD" as LOCAL midnight so the displayed date is never
  // shifted by the UTC-offset (new Date("YYYY-MM-DD") parses as UTC midnight
  // which rolls back one day in positive-offset timezones like PKT UTC+5).
  const date = raw
    ? raw instanceof Date
      ? raw
      : /^\d{4}-\d{2}-\d{2}$/.test(String(raw))
        ? (() => { const [ys, ms, ds] = String(raw).split('-'); return new Date(Number(ys), Number(ms) - 1, Number(ds)); })()
        : new Date(raw as any)
    : undefined;
  const validDate = date && isValid(date) ? date : undefined;

  const [open, setOpen] = useState(false);

  const plainDate = column?.type === "PLAIN_DATE";

  useEffect(() => {
    if (editing) {
      setOpen(true);
    }
  }, [editing]);

  if (!editing) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = !plainDate && (validDate ? validDate < today : false);
    const isSameYear = validDate?.getFullYear() === today.getFullYear();
    const displayFormat = isSameYear ? "MMM d" : "MMM d, yyyy";

    return (
      <div className={cn("flex h-full w-full items-center px-2 text-sm", isOverdue && "text-red-500")}>
        {isOverdue ? (
          <AlertCircle className="mr-2 h-4 w-4 shrink-0" />
        ) : (
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        )}
        {validDate ? format(validDate, displayFormat) : "-"}
      </div>
    );
  }

  /**
   * Expensive editor UI is only mounted while editing.
   */
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) {
          cancel();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={inputRef}
          variant="ghost"
          className="w-full cursor-pointer justify-start text-left font-normal"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancel();
            }
          }}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {validDate ? format(validDate, "dd MMM yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          autoFocus
          selected={validDate}
          onSelect={(selected) => {
            if (!selected) return;

            // Store as "YYYY-MM-DD" — no time, no timezone — so the date
            // never shifts when crossing midnight UTC boundaries.
            const y = selected.getFullYear();
            const mo = String(selected.getMonth() + 1).padStart(2, '0');
            const d = String(selected.getDate()).padStart(2, '0');
            const newValue = { date: `${y}-${mo}-${d}` };

            setValue(newValue);
            save(newValue);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}