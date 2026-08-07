"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateValue {
  date: Date;
}

interface DateBulkEditorProps {
  column: {
    id: number;
    name: string;
  };
  disabled?: boolean;
  onChange?: (value: DateValue) => void;
}

export function DateBulkEditor({
  disabled = false,
  onChange,
}: DateBulkEditorProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();

  const handleSelect = (selected: Date | undefined) => {
    if (!selected) return;

    setDate(selected);

    onChange?.({
      date: selected,
    });

    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="h-9 w-[180px] justify-start"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />

          {date ? format(date, "dd MMM yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          autoFocus
          selected={date}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}