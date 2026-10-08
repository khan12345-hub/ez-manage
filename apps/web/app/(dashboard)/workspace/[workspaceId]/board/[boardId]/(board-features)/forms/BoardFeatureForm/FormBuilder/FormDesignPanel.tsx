"use client";

import { AlignLeft, AlignCenter, AlignRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormDesign, DEFAULT_DESIGN } from "./FormPreview";

interface FormDesignPanelProps {
  design: FormDesign;
  onChange: (design: FormDesign) => void;
}

/* ── Preset palettes ─────────────────────────────────────────────── */
const ACCENT_PRESETS = [
  { label: "Blue",   value: "#0070f3" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Purple", value: "#9333ea" },
  { label: "Pink",   value: "#db2777" },
  { label: "Red",    value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber",  value: "#d97706" },
  { label: "Green",  value: "#16a34a" },
  { label: "Teal",   value: "#0d9488" },
  { label: "Slate",  value: "#475569" },
];

const BG_PRESETS = [
  { label: "Light gray", value: "#f5f6f8" },
  { label: "White",      value: "#ffffff" },
  { label: "Warm gray",  value: "#f3f4f0" },
  { label: "Soft blue",  value: "#eff6ff" },
  { label: "Soft green", value: "#f0fdf4" },
  { label: "Lavender",   value: "#f5f3ff" },
  { label: "Peach",      value: "#fff7ed" },
  { label: "Dark",       value: "#1a1b1e" },
  { label: "Deep navy",  value: "#0f172a" },
  { label: "Charcoal",   value: "#1e1e2e" },
];

const CARD_PRESETS = [
  { label: "White",     value: "#ffffff" },
  { label: "Off-white", value: "#fafafa" },
  { label: "Cream",     value: "#fffbf0" },
  { label: "Light",     value: "#f8f9fa" },
  { label: "Dark card", value: "#2b2c30" },
  { label: "Navy card", value: "#1e293b" },
];

export function FormDesignPanel({ design, onChange }: FormDesignPanelProps) {
  function update(partial: Partial<FormDesign>) {
    onChange({ ...design, ...partial });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Design</span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_DESIGN)}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Reset to defaults"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="space-y-6 px-4 py-4">

        {/* ── Form alignment ── */}
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Form alignment
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { value: "left",   Icon: AlignLeft,   label: "Left"   },
                { value: "center", Icon: AlignCenter, label: "Center" },
                { value: "right",  Icon: AlignRight,  label: "Right"  },
              ] as const
            ).map(({ value, Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ position: value })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border py-2.5 text-xs font-medium transition-colors",
                  design.position === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Accent color ── */}
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Accent color
          </p>
          <ColorGrid
            presets={ACCENT_PRESETS}
            value={design.accentColor}
            onChange={(v) => update({ accentColor: v })}
          />
        </section>

        {/* ── Page background ── */}
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Page background
          </p>
          <ColorGrid
            presets={BG_PRESETS}
            value={design.bgColor}
            onChange={(v) => update({ bgColor: v })}
          />
        </section>

        {/* ── Card background ── */}
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Card background
          </p>
          <ColorGrid
            presets={CARD_PRESETS}
            value={design.cardBg}
            onChange={(v) => update({ cardBg: v })}
          />
        </section>

        {/* ── Text color ── */}
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Text color
          </p>
          <div className="flex items-center gap-2">
            {(["#111827", "#1e293b", "#ffffff", "#f1f5f9"] as const).map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                selected={design.textColor === c}
                onClick={() => update({ textColor: c })}
              />
            ))}
            <ColorPickerInput
              value={design.textColor}
              onChange={(v) => update({ textColor: v })}
            />
          </div>
        </section>

      </div>
    </div>
  );
}

/* ── Color grid with swatches + custom picker ─────────────────────── */
function ColorGrid({
  presets,
  value,
  onChange,
}: {
  presets: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => (
        <ColorSwatch
          key={p.value}
          color={p.value}
          selected={value === p.value}
          onClick={() => onChange(p.value)}
          title={p.label}
        />
      ))}
      <ColorPickerInput value={value} onChange={onChange} />
    </div>
  );
}

function ColorSwatch({
  color,
  selected,
  onClick,
  title,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? color}
      className={cn(
        "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
        selected ? "border-foreground shadow-md scale-110" : "border-transparent",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

function ColorPickerInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-foreground"
      title="Custom color"
    >
      <span className="text-[9px] font-bold text-muted-foreground">+</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
