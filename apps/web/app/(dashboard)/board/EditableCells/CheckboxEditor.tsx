"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { CellEditorProps } from "./EditableCell";

export function CheckboxEditor({
  value,
  setValue,
  save,
}: CellEditorProps<boolean>) {
  return (
    <Checkbox
      checked={value}
      onCheckedChange={(checked) => {
        setValue(Boolean(checked));
        save();
      }}
    />
  );
}