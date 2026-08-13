"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";

import { TemplateColumn, TemplateGroup } from "./template.types";

import { TemplateColumnRow } from "./TemplateColumnRow";
import { GROUP_COLORS } from "@/constants/colors";

interface TemplateGroupCardProps {
  group: TemplateGroup;
  canDelete: boolean;

  onChange: (changes: Partial<TemplateGroup>) => void;

  onDelete: () => void;

  onAddColumn: () => void;

  onDeleteColumn: (columnId: string) => void;

  onColumnChange: (columnId: string, changes: Partial<TemplateColumn>) => void;
}

export function TemplateGroupCard({
  group,
  canDelete,
  onChange,
  onDelete,
  onAddColumn,
  onDeleteColumn,
  onColumnChange,
}: TemplateGroupCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {/* Group header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ColorPicker
          colors={GROUP_COLORS}
          value={group.color}
          onChange={(color) =>
            onChange({
              color,
            })
          }
        >
          <button
            type="button"
            className="h-8 w-8 rounded-md transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: group.color ?? "gray",
            }}
            aria-label="Change status color"
            
          />
        </ColorPicker>
        <Input
          value={group.name}
          onChange={(event) =>
            onChange({
              name: event.target.value,
            })
          }
          placeholder="Group name"
          className="h-8 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
        />

        <div className="ml-auto">
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Columns */}
      <div className="p-3">
        <div className="space-y-2">
          {group.columns.map((column) => (
            <TemplateColumnRow
              key={column.id}
              column={column}
              onChange={(changes) => onColumnChange(column.id, changes)}
              onDelete={() => onDeleteColumn(column.id)}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 h-8 px-2 text-muted-foreground"
          onClick={onAddColumn}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add column
        </Button>
      </div>
    </div>
  );
}
