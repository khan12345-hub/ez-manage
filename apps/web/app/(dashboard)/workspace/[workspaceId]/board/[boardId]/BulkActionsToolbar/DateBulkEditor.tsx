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

interface DateBulkEditorProps {
  column: {
    id: number;
    name: string;
  };
  disabled?: boolean;
  onDateChange: (
    columnId: number,
    value: {
      date: Date;
    },
  ) => void;
}

export function DateBulkEditor({
  column,
  disabled = false,
  onDateChange,
}: DateBulkEditorProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();

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
          onSelect={(selected) => {
            if (!selected) return;

            setDate(selected);

            onDateChange(column.id, {
              date: selected,
            });

            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}