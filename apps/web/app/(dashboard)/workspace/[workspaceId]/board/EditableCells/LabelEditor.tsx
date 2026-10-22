"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CellEditorProps } from "./EditableCell";
import { StatusColorPicker } from "../Cells/Status/StatusColorPicker";
import {
  createStatusOption,
  updateStatusOption,
  deleteStatusOption,
} from "@/services/status-options.api";

export interface LabelValue {
  text: string;
  color: string;
}

type Mode = "picker" | "edit";

const DEFAULT_COLOR = "#93c5fd";

function textColor(hex: string) {
  if (!hex || hex === "#e2e8f0") return "#1e293b";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#1e293b" : "#fff";
}

function LabelChip({
  label,
  onRemove,
}: {
  label: LabelValue;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5"
      style={
        label.color
          ? { backgroundColor: label.color, color: textColor(label.color) }
          : { backgroundColor: "#e2e8f0", color: "#1e293b" }
      }
    >
      <span className="max-w-[120px] truncate">{label.text}</span>
      {onRemove && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] hover:bg-black/20"
        >
          ✕
        </button>
      )}
    </span>
  );
}

export function LabelEditor({
  editing,
  value,
  setValue,
  save,
  cancel,
  column,
  boardId,
}: CellEditorProps<LabelValue[]>) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("picker");
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editOptions, setEditOptions] = useState<any[]>([]);

  // Track latest selection to avoid stale-closure issues on save
  const latestRef = useRef<LabelValue[]>([]);

  const statusOptions: any[] = column?.statusOptions ?? [];
  const columnId: number = column?.id;
  const labels: LabelValue[] = Array.isArray(value)
    ? value
    : value
    ? [value as any]
    : [];

  useEffect(() => {
    if (editing) setOpen(true);
  }, [editing]);

  // Keep latestRef in sync with incoming value
  useEffect(() => {
    latestRef.current = labels;
  });

  // ── TOGGLE LABEL SELECTION ──────────────────────────────────────────
  function toggleLabel(opt: any) {
    const isSelected = labels.some((l) => l.text === opt.label);
    const next = isSelected
      ? labels.filter((l) => l.text !== opt.label)
      : [...labels, { text: opt.label, color: opt.color }];
    setValue(next);
    latestRef.current = next;
  }

  // ── REMOVE A SELECTED CHIP ──────────────────────────────────────────
  function removeLabel(idx: number) {
    const next = labels.filter((_, i) => i !== idx);
    setValue(next);
    latestRef.current = next;
  }

  // ── CLOSE POPOVER → SAVE ────────────────────────────────────────────
  function closePopover() {
    setOpen(false);
    setSearch("");
    setMode("picker");
    save(latestRef.current);
  }

  // ── CREATE NEW LABEL (from search) ─────────────────────────────────
  async function createNewLabel() {
    const text = search.trim();
    if (!text || !columnId) return;
    setIsSaving(true);
    try {
      const created = await createStatusOption(columnId, {
        label: text,
        color: DEFAULT_COLOR,
      });
      await qc.invalidateQueries({ queryKey: ["board", boardId], exact: true });
      const next = [...latestRef.current, { text: created.label, color: created.color }];
      setValue(next);
      latestRef.current = next;
      setSearch("");
    } catch (err) {
      console.error("Failed to create label", err);
    } finally {
      setIsSaving(false);
    }
  }

  // ── EDIT MODE: apply changes ────────────────────────────────────────
  async function applyEditChanges() {
    if (isSaving || !columnId) return;
    setIsSaving(true);
    try {
      const saved = await Promise.all(
        editOptions.map((opt) =>
          opt.isNew
            ? createStatusOption(columnId, {
                label: opt.label.trim() || "New Label",
                color: opt.color,
              })
            : updateStatusOption(columnId, opt.id, {
                label: opt.label.trim(),
                color: opt.color,
              }),
        ),
      );
      await qc.invalidateQueries({ queryKey: ["board", boardId], exact: true });
      setEditOptions(saved.map((s) => ({ ...s, isNew: false })));
      setMode("picker");
    } catch (err) {
      console.error("Failed to update labels", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEditOption(opt: any) {
    if (opt.isNew) {
      setEditOptions((prev) => prev.filter((o) => o.id !== opt.id));
      return;
    }
    try {
      await deleteStatusOption(columnId, opt.id);
      await qc.invalidateQueries({ queryKey: ["board", boardId], exact: true });
      setEditOptions((prev) => prev.filter((o) => o.id !== opt.id));
    } catch (err) {
      console.error("Failed to delete label", err);
    }
  }

  function addEditOption() {
    setEditOptions((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: "",
        color: DEFAULT_COLOR,
        order: prev.length * 1000,
        isNew: true,
      },
    ]);
  }

  // ── FILTER ─────────────────────────────────────────────────────────
  const filtered = statusOptions.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );
  const noMatch = search.trim().length > 0 && filtered.length === 0;

  // ── NON-EDITING DISPLAY ────────────────────────────────────────────
  if (!editing) {
    if (!labels.length) {
      return (
        <div className="absolute inset-0 flex items-center px-2 text-[13px] text-muted-foreground/40">
          —
        </div>
      );
    }
    const MAX_SHOW = 1;
    const overflow = labels.slice(MAX_SHOW);
    return (
      <div className="absolute inset-0 flex items-center gap-1 px-2">
        {labels.slice(0, MAX_SHOW).map((l, i) => (
          <LabelChip key={i} label={l} />
        ))}
        {overflow.length > 0 && (
          <HoverCard openDelay={100} closeDelay={50}>
            <HoverCardTrigger asChild>
              <span className="flex h-5 min-w-5 cursor-default items-center justify-center rounded-full bg-gray-700 px-1 text-[10px] font-bold text-white hover:bg-gray-600">
                +{overflow.length}
              </span>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              sideOffset={6}
              className="w-auto min-w-[130px] p-2"
            >
              <div className="flex flex-col gap-1">
                {overflow.map((l, i) => (
                  <LabelChip key={i} label={l} />
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </div>
    );
  }

  // ── EDITING: POPOVER ───────────────────────────────────────────────
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) closePopover();
        else setOpen(true);
      }}
    >
      <PopoverTrigger asChild>
        <div className="absolute inset-0 flex cursor-pointer items-center gap-1 px-2">
          {labels.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">—</span>
          ) : (
            <>
              {labels.slice(0, 1).map((l, i) => (
                <LabelChip key={i} label={l} />
              ))}
              {labels.length > 1 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-700 px-1 text-[10px] font-bold text-white">
                  +{labels.length - 1}
                </span>
              )}
            </>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-64 p-0"
        onEscapeKeyDown={closePopover}
      >
        {/* ── PICKER MODE ─────────────────────────────────────────── */}
        {mode === "picker" && (
          <>
            {/* Selected chips */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
                {labels.map((l, i) => (
                  <LabelChip key={i} label={l} onRemove={() => removeLabel(i)} />
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="border-b px-3 py-2">
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && noMatch) {
                    e.preventDefault();
                    createNewLabel();
                  }
                }}
                placeholder="Create or find labels"
                className="h-8 border-none bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0"
              />
            </div>

            {/* Options list */}
            <div className="max-h-[200px] overflow-y-auto py-1">
              {noMatch ? (
                <button
                  type="button"
                  onClick={createNewLabel}
                  disabled={isSaving}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] font-medium text-primary hover:bg-muted disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create as a new label
                </button>
              ) : (
                filtered.map((opt: any) => {
                  const isSelected = labels.some((l) => l.text === opt.label);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleLabel(opt)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: opt.color || "#e2e8f0" }}
                      />
                      <span className="flex-1 truncate text-left">{opt.label}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t py-1">
              <button
                type="button"
                onClick={() => {
                  setEditOptions(statusOptions.map((o) => ({ ...o })));
                  setMode("edit");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Edit labels
              </button>
            </div>
          </>
        )}

        {/* ── EDIT MODE ──────────────────────────────────────────────── */}
        {mode === "edit" && (
          <div className="space-y-3 p-3">
            {/* Header */}
            <div className="flex items-center gap-2 pb-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setMode("picker")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">Edit Labels</span>
            </div>

            {/* Label rows */}
            <div className="max-h-[220px] space-y-1.5 overflow-y-auto">
              {editOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
                >
                  <StatusColorPicker
                    value={opt.color}
                    onChange={(color) =>
                      setEditOptions((prev) =>
                        prev.map((o) =>
                          o.id === opt.id ? { ...o, color } : o,
                        ),
                      )
                    }
                  >
                    <button
                      type="button"
                      title="Change color"
                      className="h-5 w-5 shrink-0 cursor-pointer rounded transition hover:scale-110 hover:ring-2 hover:ring-primary/50 hover:ring-offset-1"
                      style={{ backgroundColor: opt.color }}
                    />
                  </StatusColorPicker>

                  <Input
                    value={opt.label}
                    onChange={(e) =>
                      setEditOptions((prev) =>
                        prev.map((o) =>
                          o.id === opt.id
                            ? { ...o, label: e.target.value }
                            : o,
                        ),
                      )
                    }
                    className="h-auto min-w-0 flex-1 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onClick={() => deleteEditOption(opt)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={addEditOption}
              disabled={isSaving}
            >
              <Plus className="h-3.5 w-3.5" />
              New label
            </Button>

            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={applyEditChanges}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Apply"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
