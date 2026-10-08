"use client";

import { useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CellEditorProps } from "./EditableCell";

export interface EmailValue {
  email: string;
  label?: string;
}

export function EmailEditor({
  editing,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<EmailValue>) {
  const [open, setOpen] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const email = value?.email ?? "";
  const label = value?.label ?? "";
  const display = label || email;

  useEffect(() => {
    if (editing) {
      setOpen(true);
    }
  }, [editing]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }, [open]);

  const handleClose = (commit: boolean) => {
    setOpen(false);
    if (commit) save();
    else cancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleClose(true); }
    if (e.key === "Escape") { e.preventDefault(); handleClose(false); }
  };

  // ── display (not editing) ──────────────────────────────────────────────────
  if (!editing) {
    if (!email) {
      return (
        <div className="absolute inset-0 flex w-full items-center overflow-hidden px-2 text-[13px] text-muted-foreground/40">
          —
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex w-full items-center overflow-hidden px-2">
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          title={email}
          className="flex min-w-0 items-center gap-1.5 truncate rounded-full bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{display}</span>
        </a>
      </div>
    );
  }

  // ── editing — popover with two fields ─────────────────────────────────────
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose(true);
        else setOpen(true);
      }}
    >
      <PopoverTrigger asChild>
        <div className="absolute inset-0 flex w-full cursor-pointer items-center overflow-hidden px-2">
          <span className="truncate text-[13px] text-blue-600 dark:text-blue-400">
            {display || <span className="text-muted-foreground">—</span>}
          </span>
        </div>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" sideOffset={4} className="w-72 space-y-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Add email address</Label>
          <Input
            ref={emailRef}
            type="email"
            value={email}
            placeholder="name@example.com"
            onChange={(e) =>
              setValue({ email: e.target.value, label: value?.label ?? "" })
            }
            onKeyDown={handleKeyDown}
            className="h-9 text-[13px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Add text to display</Label>
          <Input
            type="text"
            value={label}
            placeholder={email || "Display text…"}
            onChange={(e) =>
              setValue({ email: value?.email ?? "", label: e.target.value })
            }
            onKeyDown={handleKeyDown}
            className="h-9 text-[13px]"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
