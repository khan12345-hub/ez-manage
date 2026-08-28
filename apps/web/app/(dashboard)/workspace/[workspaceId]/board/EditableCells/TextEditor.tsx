"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

import { CellEditorProps } from "./EditableCell";

interface Props extends CellEditorProps<string> {
  isPrimary?: boolean;
}

export function TextEditor({
  editing,
  inputRef,
  value,
  setValue,
  save,
  cancel,
  isPrimary,
}: Props) {
  const [open, setOpen] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setValue(e.target.value);
  };

  const handleSave = () => {
    setOpen(false);
    save();
  };

  const handleCancel = () => {
    setOpen(false);
    cancel();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // Primary column: Enter saves
    if (isPrimary && e.key === "Enter") {
      e.preventDefault();
      handleSave();
      return;
    }

    // Non-primary: Ctrl/Cmd + Enter saves
    if (!isPrimary && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  /**
   * Open the popover only after this cell enters edit mode.
   */
  useEffect(() => {
    if (editing && !isPrimary) {
      setOpen(true);
    }
  }, [editing, isPrimary]);

  /**
   * ------------------------------------------------------------------
   * PRIMARY COLUMN
   * ------------------------------------------------------------------
   *
   * Primary text uses a normal input, so there is no expensive
   * popover/textarea to defer.
   */
  if (isPrimary) {
    return (
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={value ?? ""}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="h-full w-full truncate rounded-none border-none bg-transparent text-[16px]! shadow-none focus-visible:ring-0"
            />
          </TooltipTrigger>

          {value && (
            <TooltipContent
              side="top"
              align="start"
              className="max-w-md whitespace-pre-wrap wrap-break-word"
            >
              {value}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  /**
   * ------------------------------------------------------------------
   * NON-PRIMARY / NOT EDITING
   * ------------------------------------------------------------------
   *
   * IMPORTANT:
   * No Popover, Textarea or PopoverContent is mounted here.
   *
   * EditableCell is responsible for changing editing -> true when
   * the cell is clicked.
   */
  if (!editing) {
    return (
      <div
        onClick={() => setOpen(true)}
        className="absolute inset-0 flex w-full items-center overflow-hidden truncate whitespace-nowrap px-2 text-[16px]"
        title={value || ""}
      >
        {value || ""}
      </div>
    );
  }

  /**
   * ------------------------------------------------------------------
   * NON-PRIMARY / EDITING
   * ------------------------------------------------------------------
   */
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          save();
          // cancel();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value ?? ""}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="h-full w-full cursor-pointer truncate rounded-none border-none bg-transparent text-[16px]! shadow-none focus-visible:ring-0"
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-[400px] p-0"
      >
        <Textarea
          value={value ?? ""}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => save}
          placeholder="Write something..."
          rows={6}
          autoFocus
          className="min-h-[140px] w-full resize-y rounded-md border-none px-3 py-3 text-[16px]! leading-6 shadow-none focus-visible:ring-0"
        />

        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>Esc to cancel</span>

          <span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
              Ctrl
            </kbd>{" "}
            +{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
              Enter
            </kbd>{" "}
            to save
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
