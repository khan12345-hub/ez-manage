"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CellEditorProps } from "./EditableCell";

export function LongTextEditor({
  editing,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<string>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (editing) setOpen(true);
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setOpen(false);
      save();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      cancel();
    }
  };

  if (!editing) {
    return (
      <div
        className="absolute inset-0 flex w-full items-start overflow-hidden px-2 py-1 text-[13px] leading-snug"
        title={value || ""}
      >
        <span className="line-clamp-2 whitespace-pre-wrap break-words">
          {value || ""}
        </span>
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) save();
      }}
    >
      <PopoverTrigger asChild>
        <div className="absolute inset-0 cursor-text" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-[480px] p-0"
      >
        <Textarea
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write notes here…"
          rows={8}
          autoFocus
          className="min-h-[180px] w-full resize-y rounded-md border-none px-3 py-3 text-[13px]! leading-6 shadow-none focus-visible:ring-0"
        />

        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>Esc to cancel</span>
          <span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Ctrl</kbd>{" "}
            +{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Enter</kbd>{" "}
            to save
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
