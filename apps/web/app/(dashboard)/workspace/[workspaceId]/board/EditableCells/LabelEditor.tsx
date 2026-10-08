"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CellEditorProps } from "./EditableCell";

export interface LabelValue {
  text: string;
  color: string; // hex or empty
}

const PALETTE = [
  "#e2e8f0", // slate
  "#fca5a5", // red
  "#fdba74", // orange
  "#fde68a", // yellow
  "#86efac", // green
  "#67e8f9", // cyan
  "#93c5fd", // blue
  "#c4b5fd", // violet
  "#f9a8d4", // pink
];

function textColor(hex: string) {
  if (!hex || hex === "#e2e8f0") return "#1e293b";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#1e293b" : "#fff";
}

export function LabelEditor({
  editing,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<LabelValue>) {
  const [open, setOpen] = useState(false);

  const text = value?.text ?? "";
  const color = value?.color ?? "";

  useEffect(() => {
    if (editing) setOpen(true);
  }, [editing]);

  const handleClose = (commit: boolean) => {
    setOpen(false);
    if (commit) save();
    else cancel();
  };

  // ── display (not editing) ─────────────────────────────────────────────────
  if (!editing) {
    if (!text) {
      return (
        <div className="absolute inset-0 flex items-center px-2 text-[13px] text-muted-foreground/40">
          —
        </div>
      );
    }
    return (
      <div className="absolute inset-0 flex items-center px-2">
        <span
          className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5"
          style={
            color
              ? { backgroundColor: color, color: textColor(color) }
              : { backgroundColor: "#e2e8f0", color: "#1e293b" }
          }
        >
          {text}
        </span>
      </div>
    );
  }

  // ── editing ───────────────────────────────────────────────────────────────
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose(true);
        else setOpen(true);
      }}
    >
      <PopoverTrigger asChild>
        <div className="absolute inset-0 flex cursor-pointer items-center px-2">
          {text ? (
            <span
              className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5"
              style={
                color
                  ? { backgroundColor: color, color: textColor(color) }
                  : { backgroundColor: "#e2e8f0", color: "#1e293b" }
              }
            >
              {text}
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground">—</span>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" sideOffset={4} className="w-64 space-y-3 p-3">
        <Input
          autoFocus
          value={text}
          placeholder="Label text…"
          onChange={(e) => setValue({ text: e.target.value, color })}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleClose(true); }
            if (e.key === "Escape") { e.preventDefault(); handleClose(false); }
          }}
          className="h-8 text-[13px]"
        />
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue({ text, color: c })}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "#6366f1" : "transparent",
              }}
            />
          ))}
          {/* clear color */}
          <button
            type="button"
            onClick={() => setValue({ text, color: "" })}
            className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground hover:border-muted-foreground"
          >
            ✕
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
