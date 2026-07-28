"use client";

import { Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const COLORS = [
  "#0086c9",
  "#94cf2d",
  "#d0b73b",
  "#fdc500",

  "#ff6b3d",
  "#ffb6b9",
  "#ff6f7d",
  "#b33771",

  "#e50073",
  "#f15bb5",
  "#f4a9ff",
  "#8e5bd9",

  "#7b4bc9",
  "#6a3d9a",
  "#4a148c",
  "#5b5bd6",

  "#355c9c",
  "#5d9cec",
  "#0d8ac7",
  "#52c7c7",

  "#6bc4f7",
  "#9ecae1",
  "#b0bec5",
  "#7d7d7d",

  "#333333",
  "#795548",
  "#d97ab8",
  "#c8b28f",

  "#9ad8f0",
  "#d39b8d",
  "#2d6cdf",
  "#245b63",

  "#b39ddb",
  "#a5b8e8",
  "#9fa8da",
  "#5d4747",
];

interface Props {
  value: string;
  onChange: (color: string) => void;
  children: React.ReactNode;
}

export function StatusColorPicker({
  value,
  onChange,
  children,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-42.5 p-2"
        align="start"
      >
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={cn(
                "relative h-8 w-8 rounded-md transition hover:scale-105",
                value === color &&
                  "ring-2 ring-primary ring-offset-2"
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