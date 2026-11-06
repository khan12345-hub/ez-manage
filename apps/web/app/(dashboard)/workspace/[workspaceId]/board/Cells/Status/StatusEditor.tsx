"use client";
import { suggestStatusCategory } from "@/lib/status-category";
import { useCanManageGroups } from "../../hooks/useCanManageGroups";

import { useEffect } from "react";
import { ArrowLeft, MoreHorizontal, Plus, Trash2, CheckCircle2 } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CellEditorProps } from "../../EditableCells/EditableCell";
import { StatusColorPicker } from "./StatusColorPicker";
import { useStatusEditor } from "./useStatusEditor";

export interface StatusOption {
  id: number;
  label: string;
  color: string;
  order: number;
  isNew?: boolean;
}

export interface StatusValue {
  label: string;
  color: string;
}

interface StatusEditorProps extends CellEditorProps<StatusValue | null> {
  usedStatusValues?: StatusValue[];
}

export function StatusEditor({
  editing,
  value,
  setValue,
  save,
  cancel,
  column,
  usedStatusValues = [],
  disabled = false,
}: StatusEditorProps) {
  const statusOptions: StatusOption[] = column?.statusOptions ?? [];
  const columnId = column?.id;

  const {
    mode,
    statuses,
    open,
    isSaving,
    setStatuses,
    setMode,
    setOpen,
    selectStatus,
    updateLabel,
    updateColor,
    toggleDone,
    addLabel,
    removeLabel,
    applyChanges,
    isStatusUsed,
    handleOpenChange,
  } = useStatusEditor({
    statusOptions,
    usedStatusValues,
    columnId,
    onSetValue: setValue,
    onSave: save,
  });
  // Changing which statuses count as done affects overdue reporting: owner/admin only (matches API).
  const canSetDone = useCanManageGroups();

  useEffect(() => {
    setStatuses(statusOptions);
  }, [statusOptions, setStatuses]);

  useEffect(() => {
    if (editing) setOpen(true);
  }, [editing, setOpen]);

  const current =
    statuses.find((s) => s.label === value?.label) ?? null;

  const currentLabel = current?.label ?? value?.label ?? "Not Started";
  const currentColor = current?.color ?? value?.color ?? "#c4c4c4";
  const currentTint = /^#[0-9a-fA-F]{6}$/.test(currentColor)
    ? `${currentColor}22`
    : currentColor;

  /* ── Non-editing display ── */
  if (!editing) {
    return (
      <div
        className={cn(
          "absolute left-0 top-0 flex h-full w-full items-center justify-center overflow-hidden px-2",
          disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer",
        )}
      >
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
          style={{ background: currentTint, color: currentColor }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: currentColor }}
            aria-hidden
          />
          <span className="min-w-0 truncate">{currentLabel}</span>
        </span>
      </div>
    );
  }

  /* ── Editing: Popover ── */
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        handleOpenChange(next);
        if (!next) cancel();
      }}
    >
      <PopoverTrigger asChild>
        <div className="absolute inset-0 flex cursor-pointer items-center justify-center px-2">
          <span
            className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-offset-1"
            style={{ background: currentTint, color: currentColor, ["--tw-ring-color" as any]: currentColor }}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: currentColor }}
              aria-hidden
            />
            <span className="min-w-0 truncate">{currentLabel}</span>
          </span>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        {/* ── PICKER MODE ── */}
        {mode === "picker" && (
          <div className="space-y-1.5">
            {statuses.map((status) => {
              const isSelected =
                value?.label === status.label && value?.color === status.color;
              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => selectStatus(status)}
                  className="relative flex h-9 w-full cursor-pointer items-center justify-center rounded-md text-[13px] font-semibold tracking-wide text-white transition hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: status.color }}
                >
                  <span className="truncate px-6">{status.label}</span>
                  {isSelected && (
                    <span className="absolute right-2.5 h-2 w-2 rounded-full bg-white/80" />
                  )}
                </button>
              );
            })}

            <div className="pt-1 border-t mt-2">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Edit Labels
              </button>
            </div>
          </div>
        )}

        {/* ── EDIT MODE ── */}
        {mode === "edit" && (
          <div className="space-y-3">
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
            <p className="-mt-1 text-[11.5px] leading-snug text-muted-foreground">
              Mark the statuses that mean <span className="font-semibold text-foreground">finished</span> (e.g. Done, Paid).
              Tasks in them are never counted as overdue.
            </p>

            {/* Label rows */}
            <div className="space-y-1.5">
              {statuses.map((status) => {
                const isUsed = isStatusUsed(status);
                const isSelected =
                  value?.label === status.label && value?.color === status.color;

                return (
                  <div
                    key={status.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                      isSelected && "border-primary ring-1 ring-primary/40",
                    )}
                  >
                    {/* Color swatch — click to change color */}
                    <StatusColorPicker
                      value={status.color}
                      onChange={(color) => updateColor(status.id, color)}
                    >
                      <button
                        type="button"
                        title="Change color"
                        className="h-5 w-5 shrink-0 rounded cursor-pointer transition hover:scale-110 hover:ring-2 hover:ring-offset-1 hover:ring-primary/50"
                        style={{ backgroundColor: status.color }}
                      />
                    </StatusColorPicker>

                    {/* Label input */}
                    <Input
                      value={status.label}
                      onChange={(e) => updateLabel(status.id, e.target.value)}
                      className="h-auto min-w-0 flex-1 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
                    />

                    {/* Counts-as-done toggle (status group) */}
                    {(() => {
                      const isDone = (status.category ?? suggestStatusCategory(status.label)) === "DONE";
                      return (
                        <button
                          type="button"
                          onClick={() => canSetDone && toggleDone(status.id)}
                          disabled={!canSetDone}
                          aria-pressed={isDone}
                          title={
                            !canSetDone
                              ? "Only board owners/admins can change which statuses count as done"
                              : isDone ? "Counts as done — click to unmark" : "Mark as a done status"
                          }
                          className={cn(
                            "flex h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
                            isDone
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                            !canSetDone && !isDone && "opacity-40",
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </button>
                      );
                    })()}

                    {/* ⋮ menu — delete */}
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
                          disabled={isUsed}
                          className={cn(
                            "gap-2",
                            !isUsed && "text-destructive focus:text-destructive",
                          )}
                          onClick={() => removeLabel(status)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>

            {/* Add new label */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={addLabel}
              disabled={isSaving}
            >
              <Plus className="h-3.5 w-3.5" />
              New label
            </Button>

            {/* Apply */}
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={applyChanges}
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
