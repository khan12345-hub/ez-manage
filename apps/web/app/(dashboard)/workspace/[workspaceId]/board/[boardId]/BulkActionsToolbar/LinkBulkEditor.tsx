"use client";

import { useState } from "react";
import { Link, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

function isValidUrl(text: string) {
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

interface LinkBulkEditorProps {
  disabled?: boolean;
  onChange?: (value: { url: string } | null) => void;
}

export function LinkBulkEditor({ disabled = false, onChange }: LinkBulkEditorProps) {
  const [value, setValue] = useState("");

  const valid = value.trim() ? isValidUrl(value.trim()) : null;

  const handleChange = (text: string) => {
    setValue(text);
    const trimmed = text.trim();
    if (!trimmed) {
      onChange?.(null);
      return;
    }
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    onChange?.(isValidUrl(trimmed) ? { url } : null);
  };

  const handleClear = () => {
    setValue("");
    onChange?.(null);
  };

  return (
    <div className="relative flex items-center">
      <Link className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="url"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste a URL…"
        className={[
          "h-9 w-[220px] pl-8 text-sm",
          value ? "pr-14" : "pr-7",
          valid === false ? "border-destructive focus-visible:ring-destructive" : "",
        ].join(" ")}
      />
      <div className="absolute right-2 flex items-center gap-1">
        {value && valid === true && (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        )}
        {value && valid === false && (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        )}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
