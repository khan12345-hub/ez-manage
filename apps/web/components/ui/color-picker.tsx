
"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  colors: string[];
  onChange: (color: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function ColorPicker({
  value,
  colors,
  onChange,
  children,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  const handleColorChange = (color: string) => {
    onChange(color);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn("w-[170px] p-2", className)}
      >
        <div className="grid grid-cols-4 gap-2">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorChange(color)}
              aria-label={`Select color ${color}`}
              className={cn(
                "relative h-8 w-8 rounded-md transition hover:scale-105",
                value === color && "ring-2 ring-primary ring-offset-2",
              )}
              style={{ backgroundColor: color }}
            >
              {value === color && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

