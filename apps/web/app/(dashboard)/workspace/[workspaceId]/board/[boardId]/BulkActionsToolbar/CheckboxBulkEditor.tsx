"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CheckboxValue {
  checked: boolean;
}

interface CheckboxBulkActionProps {
  column: {
    id: number;
    name: string;
  };
  disabled?: boolean;
  onChange?: (value: { checked: CheckboxValue }) => void;
}

export function CheckboxBulkAction({
  disabled = false,
  onChange,
}: CheckboxBulkActionProps) {
  const [checked, setChecked] = useState(false);

  // Emit initial value immediately so Apply is enabled as soon as
  // the user picks a CHECKBOX column — no extra click required.
  useEffect(() => {
    onChange?.({ checked: { checked: false } });
  }, []);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    onChange?.({ checked: { checked: next } });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={disabled}
      className="h-9 gap-2 px-3 text-xs"
    >
      {checked ? (
        <CheckSquare className="h-4 w-4 text-primary" />
      ) : (
        <Square className="h-4 w-4 text-muted-foreground" />
      )}
      {checked ? "Mark checked" : "Mark unchecked"}
    </Button>
  );
}