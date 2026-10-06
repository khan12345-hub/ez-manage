"use client";

import { useState } from "react";
import { Hash, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface NumberBulkEditorProps {
  disabled?: boolean;
  onChange?: (value: { number: number } | null) => void;
}

export function NumberBulkEditor({ disabled = false, onChange }: NumberBulkEditorProps) {
  const [raw, setRaw] = useState("");

  const handleChange = (text: string) => {
    setRaw(text);
    const parsed = parseFloat(text);
    onChange?.(!text.trim() || isNaN(parsed) ? null : { number: parsed });
  };

  const handleClear = () => {
    setRaw("");
    onChange?.(null);
  };

  const isInvalid = raw.trim() !== "" && isNaN(parseFloat(raw));

  return (
    <div className="relative flex items-center">
      <Hash className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter number…"
        className={[
          "h-9 w-[160px] pl-8 pr-7 text-sm",
          isInvalid ? "border-destructive focus-visible:ring-destructive" : "",
        ].join(" ")}
      />
      {raw && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute right-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
