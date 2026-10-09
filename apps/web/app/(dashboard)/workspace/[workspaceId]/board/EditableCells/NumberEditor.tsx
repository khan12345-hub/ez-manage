"use client";

import { Input } from "@/components/ui/input";
import { CellEditorProps } from "./EditableCell";

export function NumberEditor({
  inputRef,
  editing,
  value,
  setValue,
  save,
  cancel,
  column,
}: CellEditorProps<string | null>) {
  const isPrice = column?.type === "PRICE";

  // Display mode — show formatted value
  if (!editing) {
    if (value === null || value === "" || value === undefined) {
      return <span className="text-muted-foreground/30 text-sm"></span>;
    }
    const num = parseFloat(String(value).replace(/[$,]/g, ""));
    if (isNaN(num)) return <span className="text-sm">{value}</span>;
    if (isPrice) {
      return (
        <span className="font-mono text-sm tabular-nums">
          ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
    return (
      <span className="text-sm tabular-nums">
        {num % 1 === 0 ? num.toLocaleString() : num.toFixed(2)}
      </span>
    );
  }

  // Edit mode — plain number input
  return (
    <Input
      ref={inputRef}
      type="number"
      value={value ?? ""}
      onChange={(e) => setValue(e.target.value === "" ? null : e.target.value)}
      onBlur={() => save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") cancel();
      }}
    />
  );
}