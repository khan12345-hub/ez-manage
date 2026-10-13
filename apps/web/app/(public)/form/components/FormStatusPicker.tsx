"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusOption {
  id: number | string;
  label: string;
  value?: string;
  color: string;
}

/* ── Single-select ── */
interface SingleProps {
  id?: string;
  options: StatusOption[];
  value: string | undefined;
  multiSelect?: false;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/* ── Multi-select ── */
interface MultiProps {
  id?: string;
  options: StatusOption[];
  value: string[] | undefined;
  multiSelect: true;
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

type FormStatusPickerProps = SingleProps | MultiProps;

export function FormStatusPicker(props: FormStatusPickerProps) {
  if (!props.options.length) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        No options available.
      </div>
    );
  }

  if (props.multiSelect) {
    return <MultiPicker {...props} />;
  }

  return <SinglePicker {...(props as SingleProps)} />;
}

/* ── Single select (native <select>) ── */
function SinglePicker({ id, options, value, onChange, disabled = false }: SingleProps) {
  const selected = options.find((o) => o.label === value);

  return (
    <div className="relative">
      {selected && (
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full"
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
          "h-12 w-full appearance-none rounded-md border border-input bg-transparent",
          "py-2 pr-8 text-base outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          selected ? "pl-8" : "pl-4",
        )}
      >
        <option value="" disabled>Select an option…</option>
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

      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/* ── Multi-select (colored badge toggles) ── */
function MultiPicker({ id, options, value = [], onChange, disabled = false }: MultiProps) {
  const selected = new Set(value);

  function toggle(label: string) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange([...next]);
  }

  return (
    <div id={id} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isOn = selected.has(option.label);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(option.label)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-base font-medium transition-all",
              "border-2 disabled:cursor-not-allowed disabled:opacity-50",
              isOn ? "text-white shadow-sm" : "bg-white text-gray-700",
            )}
            style={
              isOn
                ? { backgroundColor: option.color, borderColor: option.color }
                : { borderColor: option.color, color: option.color }
            }
          >
            {isOn && <Check className="h-3 w-3 shrink-0" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
