"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AutomationStatusColumn } from "./automation.trigger";

type Props = {
  columns: AutomationStatusColumn[];
  value?: string;
  placeholder?: string;
  onSelect: (columnId: number) => void;
};

export default function AutomationStatusColumnPicker({
  columns,
  value,
  placeholder = "status",
  onSelect,
}: Props) {
  const selectedValue =
    value !== undefined && value !== ""
      ? String(value)
      : undefined;

  return (
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => {
        onSelect(Number(nextValue));
      }}
    >
      <SelectTrigger className="h-auto w-auto min-w-[150px] border-0 bg-transparent px-1 py-0 text-[25px] shadow-none focus:ring-0">
        <SelectValue placeholder={placeholder} />
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