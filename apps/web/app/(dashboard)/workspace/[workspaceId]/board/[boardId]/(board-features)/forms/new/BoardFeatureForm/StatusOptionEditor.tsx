"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createStatusOption,
  updateStatusOption,
} from "@/services/status-options.api";
import { ColorPicker } from "@/components/ui/color-picker";
import { STATUS_COLORS } from "@/constants/colors";

export interface StatusOption {
  id: string;
  label: string;
  value: string;
  color: string;
  isNew?: boolean;
}

interface StatusOptionEditorProps {
  columnId: number;
  options: StatusOption[];
  disabled?: boolean;
  onChange: (options: StatusOption[]) => void;
}

export function StatusOptionEditor({
  columnId,
  options,
  disabled = false,
  onChange,
}: StatusOptionEditorProps) {
  const [statuses, setStatuses] = useState<StatusOption[]>(options);
  const [isSaving, setIsSaving] = useState(false);

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

  function addOption() {
    const id = crypto.randomUUID();

    const newOption: StatusOption = {
      id,
      label: "New option",
      value: `option-${Date.now()}`,
      color: "gray",
      isNew: true,
    };

    setStatuses((current) => [...current, newOption]);
  }

  async function applyChanges() {
    if (isSaving || disabled || !columnId) {
      return;
    }

    setIsSaving(true);

    try {
      const savedStatuses = await Promise.all(
        statuses.map(async (status) => {
          // New option -> CREATE
          if (status.isNew) {
            const saved = await createStatusOption(columnId, {
              label: status.label.trim(),
              color: status.color,
            });

            return {
              ...saved,
              id: String(saved.id),
              isNew: false,
            };
          }

          // Existing option -> UPDATE
          const optionId = Number(status.id);

          if (Number.isNaN(optionId)) {
            throw new Error(`Invalid existing status option ID: ${status.id}`);
          }

          const saved = await updateStatusOption(columnId, optionId, {
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
        isNew: false,
      }));

      setStatuses(normalizedStatuses);

      onChange(normalizedStatuses);
    } catch (error) {
      console.error("Failed to update status options", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Status options</h3>

            {disabled && (
              <p className="mt-1 text-xs text-muted-foreground">
                Options are managed by the board column.
              </p>
            )}
          </div>

          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={isSaving}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add option
            </Button>
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
                  className="h-8 w-8 rounded-md transition hover:scale-105"
                  style={{
                    backgroundColor: status.color,
                  }}
                  aria-label="Change status color"
                />
              </ColorPicker>

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

              {status.isNew && (
                <span className="text-xs text-muted-foreground">New</span>
              )}
            </div>
          ))
        )}
      </div>

      {!disabled && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={applyChanges}
            disabled={isSaving || statuses.length === 0}
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
