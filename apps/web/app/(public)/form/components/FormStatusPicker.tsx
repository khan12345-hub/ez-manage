"use client";

import { cn } from "@/lib/utils";

interface StatusOption {
  id: number | string;
  label: string;
  value?: string;
  color: string;
}

interface FormStatusPickerProps {
  id?: string;
  options: StatusOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Native <select> for STATUS column type.
 *
 * We use a native select (not Radix) because only native <option> elements
 * reliably support per-option background colors across all browsers.
 * The trigger is styled to match the shadcn input look-and-feel, and the
 * selected option's color is reflected on the trigger via an inline style.
 */
export function FormStatusPicker({
  id,
  options,
  value,
  onChange,
  disabled = false,
}: FormStatusPickerProps) {
  // Match by label — the value the backend stores and returns
  const selected = options.find((o) => o.label === value);

  if (!options.length) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        No status options available.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Color swatch shown inside the trigger when an option is selected */}
      {selected && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: selected.color }}
          aria-hidden="true"
        />
      )}

      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          // Base layout — match shadcn Input height + border
          "h-9 w-full appearance-none rounded-md border border-input bg-transparent",
          "py-1 pr-8 text-sm outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Shift text right when the color swatch is visible
          selected ? "pl-8" : "pl-3",
        )}
      >
        {/* Placeholder option */}
        <option value="" disabled>
          Select a status…
        </option>

        {options.map((option) => (
          <option
            key={option.id}
            value={option.label}
            style={{ backgroundColor: option.color, color: "#fff" }}
          >
            {option.label}
          </option>
        ))}
      </select>

      {/* Custom chevron icon (replaces the browser default arrow) */}
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
