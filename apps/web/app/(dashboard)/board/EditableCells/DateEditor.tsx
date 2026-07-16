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
export interface DateValue {
  date: string;
}
export function DateEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<DateValue>) {
  const date = value ? parseISO(value.date) : undefined;

  return (
    <Popover defaultOpen>
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
              date: format(selected, "yyyy-MM-dd"),
            };

            setValue(newValue);
            save(newValue);
          }}
          // onKeyDown={(e) => {
          //   if (e.key === "Escape") cancel();
          // }}
        />
      </PopoverContent>
    </Popover>
  );
}
