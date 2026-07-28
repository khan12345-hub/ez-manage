"use client";

import {
  Bold,
  Italic,
} from "lucide-react";

import type { Editor } from "@tiptap/react";

import {
  Button,
} from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { TextColorPicker } from "./TextColorPicker";
import { LinkPopover } from "./LinkPopover";
import { TablePopover } from "./TablePopover";

interface RichTextToolbarProps {
  editor: Editor;
}

export function RichTextToolbar({
  editor,
}: RichTextToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleBold()
                .run()
            }
          >
            <Bold
              className={
                editor.isActive(
                  "bold",
                )
                  ? "h-4 w-4 text-primary"
                  : "h-4 w-4"
              }
            />
          </Button>
        </TooltipTrigger>

        <TooltipContent>
          Bold
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleItalic()
                .run()
            }
          >
            <Italic
              className={
                editor.isActive(
                  "italic",
                )
                  ? "h-4 w-4 text-primary"
                  : "h-4 w-4"
              }
            />
          </Button>
        </TooltipTrigger>

        <TooltipContent>
          Italic
        </TooltipContent>
      </Tooltip>

      

      <LinkPopover
        editor={editor}
      />

      <TablePopover
        editor={editor}
      />

      <TextColorPicker
        editor={editor}
      />
    </div>
  );
}