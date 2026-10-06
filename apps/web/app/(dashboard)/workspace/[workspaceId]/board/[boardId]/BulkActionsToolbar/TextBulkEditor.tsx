"use client";

import { useState } from "react";
import { Type, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TextBulkEditorProps {
  disabled?: boolean;
  onChange?: (value: { text: string } | null) => void;
}

export function TextBulkEditor({ disabled = false, onChange }: TextBulkEditorProps) {
  const [value, setValue] = useState("");

  const handleChange = (text: string) => {
    setValue(text);
    onChange?.(text.trim() ? { text } : null);
  };

  const handleClear = () => {
    setValue("");
    onChange?.(null);
  };

  return (
    <div className="relative flex items-center">
      <Type className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter text…"
        className="h-9 w-[180px] pl-8 pr-7 text-sm"
      />
      {value && (
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
