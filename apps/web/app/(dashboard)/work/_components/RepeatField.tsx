"use client";

import { useState } from "react";
import type { WorkRecurrence } from "@/services/work.api";

const FREQ: { id: WorkRecurrence["freq"]; label: string; unit: string }[] = [
  { id: "DAILY", label: "Daily", unit: "day" },
  { id: "WEEKLY", label: "Weekly", unit: "week" },
  { id: "MONTHLY", label: "Monthly", unit: "month" },
  { id: "YEARLY", label: "Yearly", unit: "year" },
];

const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/** Repeat: when the task is completed, the next one is created with its date (and time) moved on (like ClickUp). */
export function RepeatField({ value, disabled, due, onDue, onChange }: { value: WorkRecurrence | null; disabled?: boolean; due: string | null; onDue?: (iso: string | null) => void; onChange: (r: WorkRecurrence | null) => void }) {
  const [every, setEvery] = useState(String(value?.interval ?? 1));
  const f = FREQ.find((x) => x.id === value?.freq);
  const set = (patch: Partial<WorkRecurrence>) => value && onChange({ ...value, ...patch });
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
      <select aria-label="Repeat" value={value?.freq ?? ""} disabled={disabled}
        onChange={(e) => onChange(e.target.value ? { freq: e.target.value as WorkRecurrence["freq"], interval: value?.interval ?? 1, until: value?.until ?? null } : null)}
        className="h-7 rounded-md border border-transparent bg-transparent px-1 hover:border-border focus:border-border">
        <option value="">Never</option>
        {FREQ.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      {value && f && (
        <>
          <span className="text-muted-foreground">every</span>
          <input aria-label="Repeat every" type="number" min={1} max={365} value={every} disabled={disabled}
            onChange={(e) => setEvery(e.target.value)}
            onBlur={() => { const n = Math.min(365, Math.max(1, Number(every) || 1)); setEvery(String(n)); if (n !== value.interval) set({ interval: n }); }}
            className="h-7 w-12 rounded-md border border-border bg-background px-1.5 text-center" />
          <span className="text-muted-foreground">{f.unit}{Number(every) === 1 ? "" : "s"}</span>
          {/* next occurrence date + time (drives the repeat) */}
          <span className="basis-full" />
          <span className="text-muted-foreground">next</span>
          <input aria-label="Next occurrence date and time" type="datetime-local" value={toLocal(due)} disabled={disabled || !onDue}
            onChange={(e) => onDue?.(fromLocal(e.target.value))}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-[12.5px]" />
          <span className="text-muted-foreground">· until</span>
          <input aria-label="Repeat until" type="date" value={value.until ?? ""} disabled={disabled} onChange={(e) => set({ until: e.target.value || null })}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-[12.5px]" />
          {!due && <span className="basis-full text-[11.5px] text-muted-foreground">Set the next date &amp; time above, or the next one is due a {f.unit} after it&apos;s completed.</span>}
        </>
      )}
    </span>
  );
}
