"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BulkColumnSelectorProps } from "./bulkactionstoolbar.types";

// import { BulkColumnSelectorProps } from "./types";

export function BulkColumnSelector({
  columns,
  value,
  onChange,
  disabled = false,
}: BulkColumnSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-9 w-[180px]">
        <SelectValue placeholder="Select column" />
      </SelectTrigger>

      <SelectContent>
        {columns.map((column) => (
          <SelectItem
            key={column.id}
            value={String(column.id)}
          >
            {column.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}