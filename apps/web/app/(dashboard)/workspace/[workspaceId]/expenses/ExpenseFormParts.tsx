"use client";

/* Shared pieces for the reimbursement form — the branding header, a field renderer
   and value→claim helpers. Used by the in-app "New claim" drawer and the public
   shareable form page so the two always render the same form. */

import { useState } from "react";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";
import type { ExpenseForm, ExpenseFormField } from "@/services/expenses.api";

export type FieldValues = Record<string, unknown>;

/** A clean per-field value map for a fresh form (files start as empty arrays). */
export function emptyValues(fields: ExpenseFormField[]): FieldValues {
  const v: FieldValues = {};
  for (const f of fields) v[f.key] = f.type === "multiselect" || f.type === "file" ? [] : "";
  return v;
}

export interface CollectResult {
  ok: boolean;
  error?: string;
  /** mapped columns */
  title: string;
  amount: number;
  description?: string;
  incurredOn?: string;
  paidOn?: string;
  /** everything not mapped to a column */
  custom: Record<string, unknown>;
  /** File[]s from every file-type field, flattened */
  files: File[];
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Validate + split field values into claim columns, custom JSON and receipt files.
 *  `skipFiles` ignores file fields entirely — used when editing, where receipts are
 *  managed through their own add/remove controls, not re-uploaded with the fields. */
export function collect(fields: ExpenseFormField[], values: FieldValues, opts?: { skipFiles?: boolean }): CollectResult {
  const out: CollectResult = { ok: true, title: "", amount: NaN, custom: {}, files: [] };
  for (const f of fields) {
    const raw = values[f.key];
    if (f.type === "file") {
      if (opts?.skipFiles) continue;
      const list = Array.isArray(raw) ? (raw as File[]) : [];
      if (f.required && !list.length) return { ...out, ok: false, error: `"${f.label}" is required.` };
      out.files.push(...list);
      continue;
    }
    const arr = Array.isArray(raw) ? (raw as string[]) : null;
    const str = arr ? arr : raw == null ? "" : String(raw).trim();
    const empty = Array.isArray(str) ? str.length === 0 : str === "";
    if (f.required && empty) return { ...out, ok: false, error: `"${f.label}" is required.` };
    if (empty) continue;
    if (f.type === "email" && !EMAIL.test(str as string)) return { ...out, ok: false, error: `"${f.label}" must be a valid email.` };
    if (f.type === "number" && !Number.isFinite(Number(str))) return { ...out, ok: false, error: `"${f.label}" must be a number.` };
    switch (f.maps) {
      case "title": out.title = String(str).slice(0, 160); break;
      case "amount": out.amount = Number(str); break;
      case "description": out.description = String(str).slice(0, 2000); break;
      case "expenseDate": out.incurredOn = String(str); break;
      case "paymentDate": out.paidOn = String(str); break;
      default: out.custom[f.key] = str;
    }
  }
  if (!out.title) out.title = String(out.custom["expense_name"] ?? out.custom["name"] ?? "Reimbursement").slice(0, 160);
  if (!(out.amount > 0)) return { ...out, ok: false, error: "A valid amount is required." };
  return out;
}

export function FormBranding({ form, compact }: { form: Pick<ExpenseForm, "title" | "description" | "logoUrl" | "bannerUrl" | "company">; compact?: boolean }) {
  return (
    <div className={compact ? "" : "mb-4"}>
      {form.bannerUrl && (
        <div className="mb-3 overflow-hidden rounded-xl border border-border">
          <img src={resolveUrl(form.bannerUrl)} alt="" className="h-24 w-full object-cover sm:h-32" />
        </div>
      )}
      <div className="flex items-start gap-3">
        {form.logoUrl && <img src={resolveUrl(form.logoUrl)} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />}
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-tight">{form.title || "Reimbursements"}</h3>
          {form.company && <p className="text-[12px] text-muted-foreground">{form.company}</p>}
          {form.description && <p className="mt-1 text-[13px] text-muted-foreground">{form.description}</p>}
        </div>
      </div>
    </div>
  );
}

const inputCls = "h-[38px] w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50";

/** One field's input, by type. `value` is a string, string[] (multiselect) or File[] (file). */
export function FieldInput({ field, value, onChange, disabled }: { field: ExpenseFormField; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const f = field;
  if (f.type === "textarea")
    return <textarea value={(value as string) ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(inputCls, "h-auto resize-y py-2")} />;
  if (f.type === "select")
    return (
      <select value={(value as string) ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Select…</option>
        {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  if (f.type === "multiselect") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {(f.options ?? []).map((o) => {
          const on = arr.includes(o);
          return (
            <button type="button" key={o} disabled={disabled} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
              className={cn("rounded-full border px-2.5 py-1 text-[12.5px] transition-colors", on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent", disabled && "opacity-60")}>
              {o}
            </button>
          );
        })}
        {!(f.options ?? []).length && <span className="text-[12px] text-muted-foreground">No choices configured.</span>}
      </div>
    );
  }
  if (f.type === "file") return <FileField files={Array.isArray(value) ? (value as File[]) : []} onChange={(fs) => onChange(fs)} disabled={disabled} />;
  const type = f.type === "number" ? "text" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text";
  return (
    <input
      type={type}
      value={(value as string) ?? ""}
      disabled={disabled}
      inputMode={f.type === "number" ? "decimal" : undefined}
      onChange={(e) => onChange(f.type === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
      className={inputCls}
    />
  );
}

function FileField({ files, onChange, disabled }: { files: File[]; onChange: (f: File[]) => void; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => { if (!list) return; onChange([...files, ...Array.from(list)].slice(0, 10)); };
  return (
    <div>
      <label onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { if (disabled) return; e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors", over ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40", disabled && "pointer-events-none opacity-60")}>
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-[12.5px] text-muted-foreground">Drop files or <span className="font-medium text-primary">browse</span> · images or PDF, up to 10MB</span>
        <input type="file" multiple accept="image/*,application/pdf" className="hidden" disabled={disabled} onChange={(e) => add(e.target.files)} />
      </label>
      {!!files.length && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12.5px]">
              {f.type.includes("pdf") ? <FileText className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A labelled wrapper that also renders the required asterisk. */
export function FormField({ field, children }: { field: ExpenseFormField; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted-foreground">
        {field.label}{field.required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}
