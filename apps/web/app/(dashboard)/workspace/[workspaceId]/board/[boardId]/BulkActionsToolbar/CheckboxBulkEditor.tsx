"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";

export interface CheckboxValue {
  checked: boolean;
}

interface CheckboxBulkActionProps {
  column: {
    id: number;
    name: string;
  };
  disabled?: boolean;
  onChange?: (value: {
    checked: CheckboxValue;
  }) => void;
}

export function CheckboxBulkAction({
  disabled = false,
  onChange,
}: CheckboxBulkActionProps) {
  const [checked, setChecked] = useState(false);

  const handleChange = (newChecked: boolean) => {
    setChecked(newChecked);

    onChange?.({
      checked: {
        checked: newChecked,
      },
    });
  };

  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => {
        handleChange(value === true);
      }}
      className="h-8 w-8 cursor-pointer rounded-full"
    />
  );
}