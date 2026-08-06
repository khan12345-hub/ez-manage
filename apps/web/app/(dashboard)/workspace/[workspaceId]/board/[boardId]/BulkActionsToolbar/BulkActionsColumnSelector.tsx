"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SupportedBulkColumnType =
  | "STATUS"
  | "TIMELINE"
  | "DATE"
  | "CHECKBOX";

export interface BulkActionColumn {
  id: number;
  name: string;
  type: SupportedBulkColumnType;
}

interface BulkColumnSelectorProps {
  columns: BulkActionColumn[];
  value: string;
  disabled?: boolean;
  onChange: (column: BulkActionColumn) => void;
}

export function BulkColumnSelector({
  columns,
  value,
  disabled,
  onChange,
}: BulkColumnSelectorProps) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(columnId) => {
        const column = columns.find(
          (column) => String(column.id) === columnId,
        );

        if (!column) return;

        onChange(column);
      }}
    >
      <SelectTrigger className="h-9 w-[200px]">
        <SelectValue placeholder="Select column" />
      </SelectTrigger>

      <SelectContent>
        {columns.map((column) => (
          <SelectItem key={column.id} value={String(column.id)}>
            <div className="flex items-center justify-between gap-3 w-full">
              <span>{column.name}</span>

              <span className="text-xs text-muted-foreground capitalize">
                {column.type.toLowerCase()}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}