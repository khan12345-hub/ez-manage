"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

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
  onChange?: (value: DateValue | null) => void;
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
    onChange?.({ date: selected });
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDate(undefined);
    onChange?.(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="h-9 w-[180px] justify-start gap-2"
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">
            {date ? format(date, "dd MMM yyyy") : "Pick a date"}
          </span>
          {date && (
            <X
              className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start" side="top">
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