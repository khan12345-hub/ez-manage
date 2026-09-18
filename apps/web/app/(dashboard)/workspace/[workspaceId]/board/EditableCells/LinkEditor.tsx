"use client";

import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CellEditorProps } from "./EditableCell";

export function LinkEditor({
  editing,
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<string>) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (!editing) {
    if (!value) {
      return (
        <div className="absolute inset-0 flex w-full items-center overflow-hidden px-2 text-[13px] text-muted-foreground">
          —
        </div>
      );
    }

    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    return (
      <div className="absolute inset-0 flex w-full items-center overflow-hidden px-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-1 truncate text-[13px] text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          title={value}
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{value}</span>
        </a>
      </div>
    );
  }

  return (
    <Input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      value={value ?? ""}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => save()}
      placeholder="https://..."
      className="h-full w-full truncate rounded-none border-none bg-transparent text-[13px]! shadow-none focus-visible:ring-0"
    />
  );
}
