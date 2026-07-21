"use client";

import {
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

import type { Editor } from "@tiptap/react";

import {
  Button,
} from "@/components/ui/button";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TablePopoverProps {
  editor: Editor;
}

export function TablePopover({
  editor,
}: TablePopoverProps) {
  const isInTable = editor.isActive("table");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
        >
          <MoreHorizontal className="h-4 w-4" />
          Table
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-52 p-2"
      >
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            className="justify-start"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({
                  rows: 3,
                  cols: 3,
                  withHeaderRow: true,
                })
                .run()
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Insert Table
          </Button>

          {isInTable && (
            <>
              <div className="my-1 border-t" />

              <Button
                type="button"
                variant="ghost"
                className="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .deleteTable()
                    .run()
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Table
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}