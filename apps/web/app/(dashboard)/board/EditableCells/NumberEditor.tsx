"use client";

import { Input } from "@/components/ui/input";
import { CellEditorProps } from "./EditableCell";

export function NumberEditor({
  inputRef,
  value,
  setValue,
  save,
  cancel,
}: CellEditorProps<number | null>) {
  return (
    <Input
      ref={inputRef}
      autoFocus
      type="number"
      value={value ?? ""}
      onChange={(e) =>
        setValue(
          e.target.value === ""
            ? null
            : Number(e.target.value)
        )
      }
      onBlur={()=>save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") cancel();
      }}
    />
  );
}