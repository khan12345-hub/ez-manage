"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CellEditorProps } from "../../EditableCells/EditableCell";
import { StatusColorPicker } from "./StatusColorPicker";

import {
  createStatusOption,
  deleteStatusOption,
  updateStatusOption,
} from "@/services/status-options.api";
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
  isDragging?: boolean;
  statusOptions: StatusOption[];
  columnId: number;
  usedStatusValues?: StatusValue[];
}

export function StatusEditor({
  value,
  setValue,
  save,
  isDragging,
  statusOptions,
  columnId,
  usedStatusValues = [],
}: StatusEditorProps) {
  const {
    mode,
    statuses,
    open,
    isSaving,
    setStatuses,
    setMode,
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
  }, [statusOptions]);

  const current =
    statuses.find(
      (status) =>
        status.label === value?.label && status.color === value?.color,
    ) ?? null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="absolute top-0 left-0 flex h-full w-full cursor-pointer items-center justify-center text-sm font-medium text-white"
          style={{
            background: current?.color ?? value?.color ?? "#c4c4c4",
          }}
        >
          {current?.label ?? value?.label ?? "Not Started"}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        {mode === "picker" ? (
          <div className="space-y-2">
            {statuses.map((status) => {
              const isSelected =
                value?.label === status.label && value?.color === status.color;

              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => selectStatus(status)}
                  className="relative flex h-10 w-full items-center justify-center rounded text-sm font-medium text-white transition hover:opacity-90"
                  style={{
                    background: status.color,
                  }}
                >
                  {status.label}

                  {isSelected && <Check className="absolute right-3 h-4 w-4" />}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setMode("edit")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              Edit Labels
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMode("picker")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="text-sm font-medium">Edit Labels</div>
            </div>

            {statuses.map((status) => {
              const isUsed = isStatusUsed(status);

              const isSelected =
                value?.label === status.label && value?.color === status.color;

              return (
                <div
                  key={status.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2",
                    isSelected && "border-primary ring-1 ring-primary",
                  )}
                >
                  <StatusColorPicker
                    value={status.color}
                    onChange={(color) => updateColor(status.id, color)}
                  >
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white transition hover:scale-105"
                      style={{
                        backgroundColor: status.color,
                      }}
                    >
                      <Tag className="h-4 w-4" />
                    </button>
                  </StatusColorPicker>

                  <Input
                    value={status.label}
                    onChange={(e) => updateLabel(status.id, e.target.value)}
                    className="h-auto border-0 p-0 shadow-none focus-visible:ring-0"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isUsed}
                    onClick={() => removeLabel(status)}
                    className={cn(
                      "h-7 w-7 shrink-0",
                      !isUsed &&
                        "text-destructive hover:bg-destructive/10 hover:text-destructive",
                    )}
                    title={
                      isUsed
                        ? "This label is being used by a task"
                        : "Delete label"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addLabel}
              disabled={isSaving}
            >
              <Plus className="mr-2 h-4 w-4" />
              New label
            </Button>

            <Button
              type="button"
              className="w-full"
              onClick={applyChanges}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Apply"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
