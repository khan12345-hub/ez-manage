"use client";

import { Link as LinkIcon } from "lucide-react";
import { useState } from "react";

import type { Editor } from "@tiptap/react";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

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

interface LinkPopoverProps {
  editor: Editor;
}

export function LinkPopover({
  editor,
}: LinkPopoverProps) {
  const [open, setOpen] =
    useState(false);

  const [url, setUrl] =
    useState("");

  const handleOpen = (
    nextOpen: boolean,
  ) => {
    setOpen(nextOpen);

    if (nextOpen) {
      setUrl(
        editor.getAttributes("link").href ??
          "",
      );
    }
  };

  const handleSave = () => {
    if (!url.trim()) {
      editor
        .chain()
        .focus()
        .unsetLink()
        .run();

      setOpen(false);

      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: url.trim(),
        target: "_blank",
        rel: "noopener noreferrer",
      })
      .run();

    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={handleOpen}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>

        <TooltipContent>
          Add link
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        className="w-80"
      >
        <div className="space-y-3">
          <Input
            value={url}
            onChange={(e) =>
              setUrl(e.target.value)
            }
            placeholder="https://example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .unsetLink()
                  .run();

                setOpen(false);
              }}
            >
              Remove
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}