"use client";

import { useEffect } from "react";
import { ArrowLeft, MoreHorizontal, Plus, Trash2 } from "lucide-react";

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

  /* ── Non-editing display ── */
  if (!editing) {
    return (
      <div
        className={cn(
          "absolute left-0 top-0 flex h-full w-full items-center justify-center overflow-hidden px-2 text-[13px] font-semibold tracking-wide text-white",
          disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer",
        )}
        style={{ backgroundColor: currentColor }}
      >
        <span className="min-w-0 truncate">{currentLabel}</span>
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
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center text-[13px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: currentColor }}
        >
          {currentLabel}
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
