"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface StatusOption {
  id: string;
  label: string;
  color: string;
}

export interface StatusColumn {
  id: number;
  name: string;
  statusOptions?: StatusOption[];
}

interface StatusBulkActionProps {
  column: StatusColumn;
  disabled?: boolean;
  onUpdate: (columnId: number, value: any) => void;
}

export function StatusBulkAction({
  column,
  disabled = false,
  onUpdate,
}: StatusBulkActionProps) {
  const [selectedStatusId, setSelectedStatusId] = useState("");

  const options = column.statusOptions ?? [];

  const handleStatusChange = (statusId: string) => {
    setSelectedStatusId(statusId);

    const option = options.find((status) => status.id === statusId);

    if (!option) return;

    onUpdate(column.id, {
      label: option.label,
      color: option.color,
    });
  };

  return (
    <Select
      value={selectedStatusId}
      onValueChange={handleStatusChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={`Set ${column.name}`} />
      </SelectTrigger>

      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: option.color,
                }}
              />
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}