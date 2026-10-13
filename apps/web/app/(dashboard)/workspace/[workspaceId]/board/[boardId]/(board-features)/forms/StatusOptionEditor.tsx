
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_COLORS } from "@/constants/colors";
import { cn } from "@/lib/utils";

import { useStatusOptions } from "@/app/(dashboard)/workspace/[workspaceId]/board/Cells/Status/useStatusOption";

export interface StatusOption {
  id: string;
  label: string;
  color: string;
  hiddenInForm?: boolean;
}

interface StatusOptionEditorProps {
  boardId?: number;
  columnId: number;
  options: StatusOption[];
  disabled?: boolean;
  /** When true: no color edit, no label edit, no add, no delete — only hide toggle */
  readOnly?: boolean;
  label?: string;
  onChange: (options: StatusOption[]) => void;
}

export function StatusOptionEditor({
  boardId,
  columnId,
  options,
  disabled = false,
  readOnly = false,
  label = "Options",
  onChange,
}: StatusOptionEditorProps) {
  const [statuses, setStatuses] = useState<StatusOption[]>(options);
  const [loadingOptionId, setLoadingOptionId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { createStatusOption, updateStatusOption, deleteStatusOption } =
    useStatusOptions(boardId);

  useEffect(() => {
    setStatuses(options ?? []);
  }, [options]);

  const updateStatuses = (nextStatuses: StatusOption[]) => {
    setStatuses(nextStatuses);
    onChange(nextStatuses);
  };

  const updateLocalOption = (optionId: string, updates: Partial<StatusOption>) => {
    updateStatuses(
      statuses.map((s) => (s.id === optionId ? { ...s, ...updates } : s)),
    );
  };

  const toggleHide = (optionId: string) => {
    updateStatuses(
      statuses.map((s) =>
        s.id === optionId ? { ...s, hiddenInForm: !s.hiddenInForm } : s,
      ),
    );
  };

  async function addOption() {
    if (isAdding || disabled || readOnly || !columnId) return;
    setIsAdding(true);
    try {
      const randomColor =
        STATUS_COLORS[Math.floor(Math.random() * STATUS_COLORS.length)] ?? "#6366f1";
      const count = statuses.length + 1;
      const saved = await createStatusOption({
        columnId,
        payload: { label: `Option ${count}`, color: randomColor },
      });
      updateStatuses([
        ...statuses,
        { id: String(saved.id), label: saved.label, color: saved.color },
      ]);
    } catch (error) {
      console.error("Failed to create status option", error);
    } finally {
      setIsAdding(false);
    }
  }

  async function removeOption(option: StatusOption) {
    if (disabled || readOnly || loadingOptionId !== null) return;
    const optionId = Number(option.id);
    if (Number.isNaN(optionId)) return;
    setLoadingOptionId(option.id);
    try {
      await deleteStatusOption({ columnId, statusId: optionId });
      updateStatuses(statuses.filter((s) => s.id !== option.id));
    } catch (error) {
      console.error("Failed to delete status option", error);
    } finally {
      setLoadingOptionId(null);
    }
  }

  async function handleColorChange(option: StatusOption, color: string) {
    if (disabled || readOnly || loadingOptionId !== null) return;
    const optionId = Number(option.id);
    if (Number.isNaN(optionId)) return;
    setLoadingOptionId(option.id);
    try {
      const saved = await updateStatusOption({
        columnId,
        statusId: optionId,
        payload: { label: option.label.trim(), color },
      });
      updateStatuses(
        statuses.map((s) =>
          s.id === option.id
            ? { id: String(saved.id), label: saved.label, color: saved.color, hiddenInForm: s.hiddenInForm }
            : s,
        ),
      );
    } catch (error) {
      console.error("Failed to update status color", error);
    } finally {
      setLoadingOptionId(null);
    }
  }

  async function handleLabelBlur(option: StatusOption) {
    if (disabled || readOnly || loadingOptionId !== null) return;
    const trimmed = option.label.trim();
    if (!trimmed) return;
    const optionId = Number(option.id);
    if (Number.isNaN(optionId)) return;
    setLoadingOptionId(option.id);
    try {
      const saved = await updateStatusOption({
        columnId,
        statusId: optionId,
        payload: { label: trimmed, color: option.color },
      });
      updateStatuses(
        statuses.map((s) =>
          s.id === option.id
            ? { id: String(saved.id), label: saved.label, color: saved.color, hiddenInForm: s.hiddenInForm }
            : s,
        ),
      );
    } catch (error) {
      console.error("Failed to update status label", error);
    } finally {
      setLoadingOptionId(null);
    }
  }

  const canAdd = !disabled && !readOnly;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{label}</h3>
        {canAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addOption}
            disabled={isAdding || loadingOptionId !== null}
          >
            {isAdding ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add option
          </Button>
        )}
      </div>

      {/* Option list */}
      <div className="space-y-1.5">
        {statuses.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {canAdd ? 'No options yet. Click "Add option" to create one.' : "No options."}
          </div>
        ) : (
          statuses.map((status) => {
            const isLoading = loadingOptionId === status.id;

            return (
              <div
                key={status.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                  status.hiddenInForm && "opacity-50",
                )}
              >
                {/* Color swatch */}
                {readOnly ? (
                  <span
                    className="h-5 w-5 shrink-0 rounded"
                    style={{ backgroundColor: status.color }}
                  />
                ) : (
                  <ColorPicker
                    colors={STATUS_COLORS}
                    value={status.color}
                    onChange={(color) => handleColorChange(status, color)}
                  >
                    <button
                      type="button"
                      className="h-5 w-5 shrink-0 rounded cursor-pointer transition hover:scale-110 hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: status.color }}
                      aria-label="Change color"
                      disabled={isLoading || loadingOptionId !== null}
                    />
                  </ColorPicker>
                )}

                {/* Label */}
                {readOnly ? (
                  <span className={cn("flex-1 min-w-0 truncate text-sm", status.hiddenInForm && "line-through text-muted-foreground")}>
                    {status.label}
                  </span>
                ) : (
                  <Input
                    value={status.label}
                    disabled={isLoading || loadingOptionId !== null}
                    onChange={(e) => updateLocalOption(status.id, { label: e.target.value })}
                    onBlur={() => handleLabelBlur(status)}
                    placeholder="Option label"
                    className="h-auto min-w-0 flex-1 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
                  />
                )}

                {isLoading && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                )}

                {/* ⋯ menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground"
                      disabled={isLoading}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={() => toggleHide(status.id)}
                    >
                      {status.hiddenInForm ? (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Show option
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Hide option
                        </>
                      )}
                    </DropdownMenuItem>

                    {!readOnly && !disabled && (
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        disabled={isLoading || loadingOptionId !== null}
                        onClick={() => removeOption(status)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete option
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
