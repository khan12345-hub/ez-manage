"use client";

import { useState, useRef, useEffect } from "react";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
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

/* ── Multi-select (dropdown with chip trigger) ── */
function MultiPicker({ id, options, value = [], onChange, disabled = false }: MultiProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = new Set(value);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function toggle(label: string) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange([...next]);
  }

  function removeChip(label: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) return;
    onChange(value.filter((v) => v !== label));
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  }

  return (
    <div ref={containerRef} className="relative" id={id}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-left transition-colors",
          "hover:border-primary/60 focus:outline-none",
          open && "border-primary ring-1 ring-primary/30",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {value.length === 0 ? (
          <span className="flex-1 text-base text-muted-foreground">Select options…</span>
        ) : (
          <div className="flex flex-1 flex-wrap gap-1.5">
            {value.map((label) => {
              const opt = options.find((o) => o.label === label);
              return (
                <span
                  key={label}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium text-white"
                  style={{ backgroundColor: opt?.color ?? "#6366f1" }}
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => removeChip(label, e)}
                    className="ml-0.5 rounded-full hover:bg-black/20"
                    tabIndex={-1}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 pl-1">
          {value.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.map((option) => {
              const isOn = selected.has(option.label);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-base transition-colors",
                      isOn ? "bg-primary/8 font-medium" : "hover:bg-muted",
                    )}
                    onClick={() => toggle(option.label)}
                  >
                    {/* Color dot */}
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                    <span className="flex-1 text-left">{option.label}</span>
                    {isOn && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
