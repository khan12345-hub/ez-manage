"use client";

import { Link as LinkIcon } from "lucide-react";
import { useRef, useState } from "react";

import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LinkPopoverProps {
  editor: Editor;
}

export function LinkPopover({ editor }: LinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const savedSelection = useRef<{
    from: number;
    to: number;
  } | null>(null);

  const saveSelection = () => {
    const { from, to } = editor.state.selection;

    console.log("Saving selection:", { from, to });

    savedSelection.current = {
      from,
      to,
    };
  };

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setUrl(editor.getAttributes("link").href ?? "");
    }

    setOpen(nextOpen);
  };

  const restoreSelection = () => {
    const selection = savedSelection.current;

    if (!selection) {
      return;
    }

    console.log("Restoring selection:", selection);

    editor.commands.focus();

    editor.commands.setTextSelection({
      from: selection.from,
      to: selection.to,
    });
  };

  const handleSave = () => {
    if (!url.trim()) {
      handleRemoveLink();
      return;
    }

    restoreSelection();

    editor
      .chain()
      .setLink({
        href: url.trim(),
        target: "_blank",
        rel: "noopener noreferrer",
      })
      .run();

    setOpen(false);
  };

  const handleRemoveLink = () => {
    restoreSelection();

    editor
      .chain()
      .unsetLink()
      .run();

    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={handleOpen}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onMouseDown={(event) => {
            // CRITICAL:
            // Prevent browser from moving focus away from Tiptap
            event.preventDefault();

            // Save the actual editor selection
            saveSelection();
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-80"
      >
        <div className="space-y-3">
          <Input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            placeholder="https://example.com"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSave();
              }
            }}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemoveLink}
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