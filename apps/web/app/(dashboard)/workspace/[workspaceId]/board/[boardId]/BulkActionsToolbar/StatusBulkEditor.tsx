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
  statusOptions: StatusOption[];
}

interface StatusBulkActionProps {
  column: StatusColumn;
  disabled?: boolean;
  onChange?: (value: {
    label: string;
    color: string;
  }) => void;
}

export function StatusBulkAction({
  column,
  disabled = false,
  onChange,
}: StatusBulkActionProps) {
  const [selectedStatusId, setSelectedStatusId] = useState("");

  const handleChange = (statusId: string) => {
    setSelectedStatusId(statusId);

    const option = column.statusOptions.find(
      (status) => status.id === statusId,
    );

    if (!option) return;

    onChange?.({
      label: option.label,
      color: option.color,
    });
  };

  return (
    <Select
      value={selectedStatusId}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-9 w-[180px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>

      <SelectContent>
        {column.statusOptions.map((option) => (
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