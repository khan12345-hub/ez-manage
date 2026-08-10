"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createStatusOption,
  deleteStatusOption,
  updateStatusOption,
} from "@/services/status-options.api";
import { ColorPicker } from "@/components/ui/color-picker";
import { STATUS_COLORS } from "@/constants/colors";

export interface StatusOption {
  id: string;
  label: string;
  value: string;
  color: string;
}

interface StatusOptionEditorProps {
  //   boardId: number;
  columnId: number;
  options: StatusOption[];
  disabled?: boolean;
  onChange: (options: StatusOption[]) => void;
}

export function StatusOptionEditor({
  //   boardId,
  columnId,
  options,
  disabled = false,
  onChange,
}: StatusOptionEditorProps) {
  const queryClient = useQueryClient();

  const [statuses, setStatuses] = useState<StatusOption[]>(options);

  const [isSaving, setIsSaving] = useState(false);

  /**
   * Keep local state in sync when the board
   * data changes.
   */
  useEffect(() => {
    setStatuses(options);
  }, [options]);

  function updateLocalOption(optionId: string, updates: Partial<StatusOption>) {
    setStatuses((current) =>
      current.map((status) =>
        status.id === optionId
          ? {
              ...status,
              ...updates,
            }
          : status,
      ),
    );
  }

  async function applyChanges() {
    if (isSaving || disabled) {
      return;
    }

    setIsSaving(true);

    try {
      const savedStatuses = await Promise.all(
        statuses.map(async (status) => {
          const saved = await updateStatusOption(columnId, Number(status.id), {
            label: status.label.trim(),
            color: status.color,
          });

          return {
            ...saved,
            id: String(saved.id),
            isNew: false,
          };
        }),
      );

      const normalizedStatuses = savedStatuses.map((status) => ({
        ...status,
        id: String(status.id),
      }));

      // Update FormBuilder state
      onChange(normalizedStatuses);

      // Refresh board
      //   await queryClient.invalidateQueries({
      //     queryKey: ["board", boardId],
      //   });
    } catch (error) {
      console.error("Failed to update status options", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">Status options</label>

          {disabled && (
            <p className="mt-1 text-xs text-muted-foreground">
              Options are managed by the board column.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {statuses.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No status options.
          </div>
        ) : (
          statuses.map((status) => (
            <div
              key={status.id}
              className="flex items-center gap-2 rounded-md border p-2"
            >

              <ColorPicker
                colors={STATUS_COLORS}
                value={status.color}
                onChange={(color) =>
                  updateLocalOption(status.id, {
                    color,
                  })
                }
              >
                <button
                  type="button"
                  className="h-8 w-8 rounded-md border transition hover:scale-105"
                  style={{
                    backgroundColor: status.color,
                  }}
                  aria-label="Change status color"
                />
              </ColorPicker>

              {/* Label */}
              <Input
                value={status.label}
                disabled={disabled || isSaving}
                onChange={(event) =>
                  updateLocalOption(status.id, {
                    label: event.target.value,
                  })
                }
                placeholder="Option label"
                className="flex-1"
              />

              {/* Value */}
              <Input
                value={status.value}
                disabled
                placeholder="Value"
                className="flex-1"
              />
            </div>
          ))
        )}
      </div>

      {!disabled && statuses.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={applyChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Apply changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
