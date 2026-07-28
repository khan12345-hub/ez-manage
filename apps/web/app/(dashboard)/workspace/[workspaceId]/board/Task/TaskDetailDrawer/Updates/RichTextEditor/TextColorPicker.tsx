"use client";

import { Palette } from "lucide-react";
import type { Editor } from "@tiptap/react";

import {
  Button,
} from "@/components/ui/button";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TextColorPickerProps {
  editor: Editor;
}

const colors = [
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function TextColorPicker({
  editor,
}: TextColorPickerProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>

        <TooltipContent>
          Text color
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        className="w-auto p-2"
      >
        <div className="grid grid-cols-5 gap-2">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setColor(color)
                  .run()
              }
              className="h-7 w-7 rounded-full border transition-transform hover:scale-110"
              style={{
                backgroundColor: color,
              }}
              aria-label={`Set text color ${color}`}
            />
          ))}

          <button
            type="button"
            onClick={() =>
              editor
                .chain()
                .focus()
                .unsetColor()
                .run()
            }
            className="flex h-7 w-7 items-center justify-center rounded-full border text-xs"
            title="Reset color"
          >
            ×
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}