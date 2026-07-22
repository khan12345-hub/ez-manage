"use client";

import { Check } from "lucide-react";

interface CheckboxCellProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export function CheckboxCell({
  checked = false,
  onChange,
}: CheckboxCellProps) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      className="flex h-full w-full cursor-pointer items-center justify-center"
    >
      {checked && (
        <Check className="h-5 w-5 text-green-600" />
      )}
    </button>
  );
}