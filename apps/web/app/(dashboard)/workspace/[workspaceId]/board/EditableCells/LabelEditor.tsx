"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CellEditorProps } from "./EditableCell";

export interface LabelValue {
  text: string;
  color: string;
}

const PALETTE = [
  "#e2e8f0", "#fca5a5", "#fdba74", "#fde68a",
  "#86efac", "#67e8f9", "#93c5fd", "#c4b5fd", "#f9a8d4",
];

function textColor(hex: string) {
  if (!hex || hex === "#e2e8f0") return "#1e293b";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#1e293b" : "#fff";
}

function LabelChip({ label }: { label: LabelValue }) {
  return (
    <span
      className="inline-block max-w-[120px] shrink-0 truncate rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5"
      style={
        label.color
          ? { backgroundColor: label.color, color: textColor(label.color) }
          : { backgroundColor: "#e2e8f0", color: "#1e293b" }
      }
    >
      {label.text}
    </span>
  );
}

export function LabelEditor({
  editing,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<LabelValue[]>) {
  const [open, setOpen] = useState(false);
  // Which label is being edited (index), or -1 for new
  const [editingIdx, setEditingIdx] = useState<number>(-1);
  const [draftText, setDraftText] = useState("");
  const [draftColor, setDraftColor] = useState("");

  const labels: LabelValue[] = Array.isArray(value) ? value : (value ? [value as any] : []);

  useEffect(() => {
    if (editing) setOpen(true);
  }, [editing]);

  function openEdit(idx: number) {
    if (idx === -1) {
      setDraftText("");
      setDraftColor(PALETTE[0]);
    } else {
      setDraftText(labels[idx]?.text ?? "");
      setDraftColor(labels[idx]?.color ?? "");
    }
    setEditingIdx(idx);
  }

  function commitDraft() {
    if (!draftText.trim()) return;
    const next = [...labels];
    if (editingIdx === -1) {
      next.push({ text: draftText.trim(), color: draftColor });
    } else {
      next[editingIdx] = { text: draftText.trim(), color: draftColor };
    }
    setValue(next);
    setEditingIdx(-1);
    setDraftText("");
  }

  function removeLabel(idx: number) {
    const next = labels.filter((_, i) => i !== idx);
    setValue(next);
  }

  function handleClose() {
    setOpen(false);
    save();
    cancel();
  }

  /* ── display (not editing) ── */
  if (!editing) {
    if (!labels.length) {
      return (
        <div className="absolute inset-0 flex items-center px-2 text-[13px] text-muted-foreground/40">
          —
        </div>
      );
    }
    const MAX_SHOW = 1;
    const overflowLabels = labels.slice(MAX_SHOW);
    const overflow = overflowLabels.length;
    return (
      <div className="absolute inset-0 flex items-center gap-1 px-2">
        {labels.slice(0, MAX_SHOW).map((l, i) => (
          <LabelChip key={i} label={l} />
        ))}
        {overflow > 0 && (
          <HoverCard openDelay={100} closeDelay={50}>
            <HoverCardTrigger asChild>
              <span className="flex h-5 min-w-5 cursor-default items-center justify-center rounded-full bg-gray-700 px-1 text-[10px] font-bold text-white hover:bg-gray-600">
                +{overflow}
              </span>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              sideOffset={6}
              className="w-auto min-w-[130px] p-2"
            >
              <div className="flex flex-col gap-1">
                {overflowLabels.map((l, i) => (
                  <span
                    key={i}
                    className="block truncate rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5"
                    style={
                      l.color
                        ? { backgroundColor: l.color, color: textColor(l.color) }
                        : { backgroundColor: "#e2e8f0", color: "#1e293b" }
                    }
                  >
                    {l.text}
                  </span>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </div>
    );
  }

  /* ── editing (popover) ── */
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else setOpen(true);
      }}
    >
      <PopoverTrigger asChild>
        <div className="absolute inset-0 flex cursor-pointer items-center gap-1 px-2">
          {labels.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">—</span>
          ) : (
            labels.slice(0, 1).map((l, i) => <LabelChip key={i} label={l} />)
          )}
          {labels.length > 1 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-700 px-1 text-[10px] font-bold text-white">
              +{labels.length - 1}
            </span>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" sideOffset={4} className="w-72 space-y-3 p-3">
        {/* Existing labels */}
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l, i) => (
              <div key={i} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(i)}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 hover:opacity-80"
                  style={
                    l.color
                      ? { backgroundColor: l.color, color: textColor(l.color) }
                      : { backgroundColor: "#e2e8f0", color: "#1e293b" }
                  }
                >
                  {l.text}
                </button>
                <button
                  type="button"
                  onClick={() => removeLabel(i)}
                  className="hidden h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-destructive/20 hover:text-destructive group-hover:flex"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Draft editor */}
        {editingIdx !== -1 ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={draftText}
              placeholder="Label text…"
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitDraft(); }
                if (e.key === "Escape") { e.preventDefault(); setEditingIdx(-1); }
              }}
              className="h-8 text-[13px]"
            />
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraftColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    draftColor === c ? "border-indigo-500 scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={commitDraft}
                className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                {editingIdx === -1 ? "Add" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingIdx(-1)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openEdit(-1)}
            className="flex w-full items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            + Add label
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
