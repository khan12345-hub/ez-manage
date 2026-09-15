"use client";

import { format, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
  date?: Date;
}

export function DateEditor({
  editing,
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<DateValue>) {
  const raw = value?.date;
  const date = raw ? (raw instanceof Date ? raw : new Date(raw as any)) : undefined;
  const validDate = date && isValid(date) ? date : undefined;

  const [open, setOpen] = useState(false);

  /**
   * Only open the popover when the cell actually enters edit mode.
   */
  useEffect(() => {
    if (editing) {
      setOpen(true);
    }
  }, [editing]);

  /**
   * Cheap display when the cell isn't being edited.
   * No Popover or Calendar is mounted.
   */
  if (!editing) {
    return (
      <div className="flex h-full w-full items-center px-2 text-sm">
          <CalendarIcon className="mr-4 h-4 w-4" />
        {validDate ? format(validDate, "dd MMM yyyy") : "-"}
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

            const newValue = {
              date: selected,
            };

            setValue(newValue);
            save(newValue);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}