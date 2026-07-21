"use client";

import { Table2 } from "lucide-react";
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

interface TablePopoverProps {
  editor: Editor;
}

const MAX_ROWS = 6;
const MAX_COLS = 6;

export function TablePopover({
  editor,
}: TablePopoverProps) {
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
              <Table2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>

        <TooltipContent>
          Insert table
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        className="w-auto p-3"
      >
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Select table size
          </p>

          <div className="grid gap-1">
            {Array.from({
              length: MAX_ROWS,
            }).map((_, row) => (
              <div
                key={row}
                className="flex gap-1"
              >
                {Array.from({
                  length: MAX_COLS,
                }).map((_, col) => (
                  <button
                    key={col}
                    type="button"
                    className="h-5 w-5 rounded-sm border bg-muted transition-colors hover:bg-primary"
                    onClick={() => {
                      editor
                        .chain()
                        .focus()
                        .insertTable({
                          rows: row + 1,
                          cols: col + 1,
                          withHeaderRow: true,
                        })
                        .run();
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}