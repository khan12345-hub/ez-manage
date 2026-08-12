
"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { STATUS_COLORS } from "@/constants/colors";

import { useStatusOptions } from "@/app/(dashboard)/workspace/[workspaceId]/board/Cells/Status/useStatusOption";

export interface StatusOption {
  id: string;
  label: string;
  color: string;
}

interface StatusOptionEditorProps {
  boardId?: number;
  columnId: number;
  options: StatusOption[];
  disabled?: boolean;
  onChange: (options: StatusOption[]) => void;
}

export function StatusOptionEditor({
  boardId,
  columnId,
  options,
  disabled = false,
  onChange,
}: StatusOptionEditorProps) {
  const [statuses, setStatuses] =
    useState<StatusOption[]>(options);

  const [loadingOptionId, setLoadingOptionId] =
    useState<string | null>(null);

  const [isAdding, setIsAdding] =
    useState(false);

  const {
    createStatusOption,
    updateStatusOption,
    deleteStatusOption,
  } = useStatusOptions(boardId);

  /**
   * Keep local state synchronized with the
   * parent field state.
   */
  useEffect(() => {
    setStatuses(options ?? []);
  }, [options]);

  /**
   * Update both local state and parent state.
   *
   * IMPORTANT:
   * Every status option change must reach FormFieldCard
   * so that it eventually reaches FormBuilder.form.fields.
   */
  const updateStatuses = (
    nextStatuses: StatusOption[],
  ) => {
    setStatuses(nextStatuses);

    // This is what updates field.options in the parent.
    onChange(nextStatuses);
  };

  /**
   * Update an option locally.
   *
   * This is used while typing the label.
   */
  const updateLocalOption = (
    optionId: string,
    updates: Partial<StatusOption>,
  ) => {
    const nextStatuses = statuses.map(
      (status) =>
        status.id === optionId
          ? {
              ...status,
              ...updates,
            }
          : status,
    );

    updateStatuses(nextStatuses);
  };

  /**
   * Create a new status option.
   */
  async function addOption() {
    if (
      isAdding ||
      disabled ||
      !columnId
    ) {
      return;
    }

    setIsAdding(true);

    try {
      const randomColor =
        STATUS_COLORS[
          Math.floor(
            Math.random() *
              STATUS_COLORS.length,
          )
        ] ?? "gray";

      const saved =
        await createStatusOption({
          columnId,

          payload: {
            label: "New option",
            color: randomColor,
          },
        });

      const newOption: StatusOption = {
        id: String(saved.id),
        label: saved.label,
        // value: saved.value,
        color: saved.color,
      };

      const nextStatuses = [
        ...statuses,
        newOption,
      ];

      updateStatuses(nextStatuses);
    } catch (error) {
      console.error(
        "Failed to create status option",
        error,
      );
    } finally {
      setIsAdding(false);
    }
  }

  /**
   * Delete a status option.
   */
  async function removeOption(
    option: StatusOption,
  ) {
    if (
      disabled ||
      loadingOptionId !== null
    ) {
      return;
    }

    const optionId = Number(option.id);

    if (Number.isNaN(optionId)) {
      console.error(
        `Invalid status option ID: ${option.id}`,
      );

      return;
    }

    setLoadingOptionId(option.id);

    try {
      await deleteStatusOption({
        columnId,
        statusId: optionId,
      });

      const nextStatuses =
        statuses.filter(
          (status) =>
            status.id !== option.id,
        );

      updateStatuses(nextStatuses);
    } catch (error) {
      console.error(
        "Failed to delete status option",
        error,
      );
    } finally {
      setLoadingOptionId(null);
    }
  }

  /**
   * Update status color.
   */
  async function handleColorChange(
    option: StatusOption,
    color: string,
  ) {
    if (
      disabled ||
      loadingOptionId !== null
    ) {
      return;
    }

    const optionId = Number(option.id);

    if (Number.isNaN(optionId)) {
      console.error(
        `Invalid status option ID: ${option.id}`,
      );

      return;
    }

    setLoadingOptionId(option.id);

    try {
      const saved =
        await updateStatusOption({
          columnId,
          statusId: optionId,

          payload: {
            label: option.label.trim(),
            color,
          },
        });

      const updatedOption: StatusOption = {
        id: String(saved.id),
        label: saved.label,
        color: saved.color,
      };

      const nextStatuses =
        statuses.map((status) =>
          status.id === option.id
            ? updatedOption
            : status,
        );

      updateStatuses(nextStatuses);
    } catch (error) {
      console.error(
        "Failed to update status color",
        error,
      );
    } finally {
      setLoadingOptionId(null);
    }
  }

  /**
   * Update status label after leaving the input.
   */
  async function handleLabelBlur(
    option: StatusOption,
  ) {
    if (
      disabled ||
      loadingOptionId !== null
    ) {
      return;
    }

    const label = option.label.trim();

    if (!label) {
      return;
    }

    const optionId = Number(option.id);

    if (Number.isNaN(optionId)) {
      console.error(
        `Invalid status option ID: ${option.id}`,
      );

      return;
    }

    setLoadingOptionId(option.id);

    try {
      const saved =
        await updateStatusOption({
          columnId,
          statusId: optionId,

          payload: {
            label,
            color: option.color,
          },
        });

      const updatedOption: StatusOption = {
        id: String(saved.id),
        label: saved.label,
        color: saved.color,
      };

      const nextStatuses =
        statuses.map((status) =>
          status.id === option.id
            ? updatedOption
            : status,
        );

      updateStatuses(nextStatuses);
    } catch (error) {
      console.error(
        "Failed to update status label",
        error,
      );
    } finally {
      setLoadingOptionId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">
              Status options
            </h3>

            {disabled && (
              <p className="mt-1 text-xs text-muted-foreground">
                Options are managed by the board
                column.
              </p>
            )}
          </div>

          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={
                isAdding ||
                loadingOptionId !== null
              }
            >
              {isAdding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}

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
          statuses.map((status) => {
            const isLoading =
              loadingOptionId === status.id;

            return (
              <div
                key={status.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <ColorPicker
                  colors={STATUS_COLORS}
                  value={status.color}
                  onChange={(color) =>
                    handleColorChange(
                      status,
                      color,
                    )
                  }
                >
                  <button
                    type="button"
                    className="h-8 w-8 rounded-md transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor:
                        status.color,
                    }}
                    aria-label="Change status color"
                    disabled={
                      disabled ||
                      isLoading ||
                      loadingOptionId !== null
                    }
                  />
                </ColorPicker>

                <Input
                  value={status.label}
                  disabled={
                    disabled ||
                    isLoading ||
                    loadingOptionId !== null
                  }
                  onChange={(event) =>
                    updateLocalOption(
                      status.id,
                      {
                        label:
                          event.target.value,
                      },
                    )
                  }
                  onBlur={() =>
                    handleLabelBlur(status)
                  }
                  placeholder="Option label"
                  className="flex-1"
                />

                {isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}

                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                      removeOption(status)
                    }
                    disabled={
                      isLoading ||
                      loadingOptionId !== null
                    }
                    aria-label={`Remove ${status.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

