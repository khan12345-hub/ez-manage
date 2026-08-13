"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { STATUS_COLORS } from "@/constants/colors";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { TemplateColumn, TemplateStatusOption } from "./template.types";

const COLUMN_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "STATUS", label: "Status" },
  { value: "PERSON", label: "Person" },
  { value: "DATE", label: "Date" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "FILE", label: "file" },
  { value: "TIMELINE", label: "timeline" },
];

interface TemplateColumnRowProps {
  column: TemplateColumn;

  onChange: (changes: Partial<TemplateColumn>) => void;

  onDelete: () => void;
}

export function TemplateColumnRow({
  column,
  onChange,
  onDelete,
}: TemplateColumnRowProps) {
  const statusOptions = column.options?.statusOptions ?? [];

  function updateStatusOptions(options: TemplateStatusOption[]) {
    onChange({
      options: {
        ...(column.options ?? {}),
        statusOptions: options.map((option, index) => ({
          ...option,
          order: (index + 1) * 1000,
        })),
      },
    });
  }

  function addStatusOption() {
    const optionNumber = statusOptions.length + 1;
    const color =
      STATUS_COLORS[statusOptions.length % STATUS_COLORS.length] ?? "gray";

    updateStatusOptions([
      ...statusOptions,
      {
        id: crypto.randomUUID(),
        label: `Option ${optionNumber}`,
        color,
        order: (statusOptions.length + 1) * 1000,
      },
    ]);
  }

  function updateStatusOption(
    optionId: string,
    changes: Partial<TemplateStatusOption>,
  ) {
    updateStatusOptions(
      statusOptions.map((option) =>
        option.id === optionId
          ? {
              ...option,
              ...changes,
            }
          : option,
      ),
    );
  }

  function removeStatusOption(optionId: string) {
    updateStatusOptions(
      statusOptions.filter((option) => option.id !== optionId),
    );
  }

  return (
    <div className="group rounded-md border bg-background px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={column.name}
          onChange={(event) =>
            onChange({
              name: event.target.value,
            })
          }
          placeholder="Column name"
          className="h-8 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        />

        {!column.isPrimary && (
          <>
            <Select
              value={column.type}
              onValueChange={(value) =>
                onChange({
                  type: value,
                })
              }
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {COLUMN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        )}
      </div>

      {column.type === "STATUS" && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground">
              Status options
            </h4>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={addStatusOption}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add option
            </Button>
          </div>

          {statusOptions.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              No status options.
            </div>
          ) : (
            statusOptions.map((status) => (
              <div key={status.id} className="flex items-center gap-2">
                <ColorPicker
                  colors={STATUS_COLORS}
                  value={status.color}
                  onChange={(color) => updateStatusOption(status.id, { color })}
                >
                  <button
                    type="button"
                    className="h-8 w-8 shrink-0 rounded-md transition hover:scale-105"
                    style={{
                      backgroundColor: status.color,
                    }}
                    aria-label="Change status color"
                  />
                </ColorPicker>

                <Input
                  value={status.label}
                  onChange={(event) =>
                    updateStatusOption(status.id, {
                      label: event.target.value,
                    })
                  }
                  placeholder="Option label"
                  className="h-8 flex-1"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeStatusOption(status.id)}
                  aria-label={`Remove ${status.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
