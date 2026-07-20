"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { CellEditorProps } from "./EditableCell";
import { useState } from "react";
export interface DateValue {
  date?: Date;
}
export function DateEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<DateValue>) {
  console.log("DATE", value);
  const date = value?.date;
  // const date = new Date()
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={inputRef}
          variant="outline"
          className="w-full justify-start text-left font-normal cursor-pointer"
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : "Pick a date"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          autoFocus
          selected={date}
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
