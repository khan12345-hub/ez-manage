"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const COLORS = [
  "#0F7B45",
  "#16C172",
  "#9CD521",
  "#D1BE3D",
  "#FFC107",

  "#6F42C1",
  "#9B51E0",
  "#0F83B8",
  "#4F8EEA",
  "#6CC0F2",

  "#BE3455",
  "#FF0080",
  "#EC4BB8",
  "#FF6A32",
  "#FFAD42",

  "#8B5E4C",
  "#C4C4C4",
  "#808080",
];

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

export function ColorPicker({
  value,
  onChange,
}: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md border"
        >
          <div
            className="h-5 w-5 rounded"
            style={{ backgroundColor: value || "#d1d5db" }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-fit p-3">
        <div className="grid grid-cols-5 gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChange(color)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition hover:scale-105",
                value === color && "ring-2 ring-black ring-offset-2"
              )}
              style={{ backgroundColor: color }}
            >
              {value === color && (
                <Check className="h-4 w-4 text-white" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}