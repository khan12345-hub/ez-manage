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
  type: string;

  // Keep additional properties from your actual board column
  statusOptions: {
    id: string;
    label: string;
    color: string;
  }[];
}

interface BulkColumnSelectorProps {
  columns: BulkActionColumn[];
  value: string;
  disabled?: boolean;
  onChange: (column: BulkActionColumn) => void;
}

const SUPPORTED_COLUMN_TYPES: SupportedBulkColumnType[] = [
  "STATUS",
  "TIMELINE",
  "DATE",
  "CHECKBOX",
];

export function BulkColumnSelector({
  columns,
  value,
  disabled,
  onChange,
}: BulkColumnSelectorProps) {
  const supportedColumns = columns.filter((column) =>
    SUPPORTED_COLUMN_TYPES.includes(
      column.type as SupportedBulkColumnType,
    ),
  );

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(columnId) => {
        const column = supportedColumns.find(
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
        {supportedColumns.map((column) => (
          <SelectItem
            key={column.id}
            value={String(column.id)}
          >
            <div className="flex w-full items-center justify-between gap-3">
              <span>{column.name}</span>

              <span className="text-xs capitalize text-muted-foreground">
                {column.type.toLowerCase()}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}