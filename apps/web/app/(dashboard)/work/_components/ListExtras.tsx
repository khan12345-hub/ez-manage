"use client";

/* List view extras (ClickUp-style): per-column "Calculate" footer and the bulk-action bar. */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, CalendarDays, CircleDot, Flag, Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMinutes, workApi, workKeys, type FieldValues, type TaskInput, type WorkField, type WorkListDetail, type WorkTask } from "@/services/work.api";
import { AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from "./pickers";
import { cfId, colMeta, isCf, type Col } from "./viewSettings";

export type Calc = "none" | "sum" | "avg" | "min" | "max" | "filled" | "empty" | "pct";
const NUM_CALCS: Calc[] = ["sum", "avg", "min", "max", "filled", "empty", "pct"];
const ANY_CALCS: Calc[] = ["filled", "empty", "pct"];
const CALC_LABEL: Record<Calc, string> = { none: "None", sum: "Sum", avg: "Average", min: "Min", max: "Max", filled: "Filled", empty: "Empty", pct: "Percent filled" };

function numeric(c: Col, fields: WorkField[]) {
  if (c === "estimate") return true;
  if (!isCf(c)) return false;
  const t = fields.find((f) => f.id === cfId(c))?.type;
  return t === "number" || t === "money" || t === "progress" || t === "rating";
}

function valueOf(c: Col, t: WorkTask, fields: WorkField[], values: FieldValues): unknown {
  if (isCf(c)) {
    const v = values[t.id]?.[cfId(c)];
    return v === undefined || v === null || (Array.isArray(v) && !v.length) ? null : v;
  }
  switch (c) {
    case "assignee": return t.assignees.length ? t.assignees : null;
    case "due": return t.dueDate;
    case "start": return t.startDate;
    case "priority": return t.priority;
    case "estimate": return t.timeEstimate;
    case "tags": return t.tags?.length ? t.tags : null;
    case "created": return t.createdAt;
  }
}

function compute(calc: Calc, c: Col, tasks: WorkTask[], fields: WorkField[], values: FieldValues) {
  const raw = tasks.map((t) => valueOf(c, t, fields, values));
  const filled = raw.filter((v) => v !== null && v !== undefined && v !== "");
  if (calc === "filled") return `${filled.length} filled`;
  if (calc === "empty") return `${raw.length - filled.length} empty`;
  if (calc === "pct") return `${raw.length ? Math.round((filled.length / raw.length) * 100) : 0}% filled`;
  const nums = filled.map(Number).filter((n) => Number.isFinite(n));
  if (!nums.length) return "—";
  const n = calc === "sum" ? nums.reduce((a, b) => a + b, 0) : calc === "avg" ? nums.reduce((a, b) => a + b, 0) / nums.length : calc === "min" ? Math.min(...nums) : Math.max(...nums);
  if (c === "estimate") return formatMinutes(Math.round(n));
  const f = isCf(c) ? fields.find((x) => x.id === cfId(c)) : null;
  if (f?.type === "money") {
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: f.config?.currency ?? "USD", maximumFractionDigits: 2 }).format(n); } catch { /* fall through */ }
  }
  if (f?.type === "progress") return `${Math.round(n)}%`;
  return Number(n.toFixed(2)).toLocaleString("en-US");
}

/** Footer under a group: one "Calculate" cell per column. */
export function CalcRow({ columns, fields, values, tasks, calcs, onCalc, grid }: { columns: Col[]; fields: WorkField[]; values: FieldValues; tasks: WorkTask[]; calcs: Record<string, Calc>; onCalc: (c: Col, calc: Calc) => void; grid: React.CSSProperties }) {
  if (!columns.length) return null;
  return (
    <div className="group/calc grid min-h-[34px] items-center border-t border-border/70 bg-table-head/40 px-3 text-[12px]" style={grid}>
      <span />
      {columns.map((c) => (
        <CalcCell key={c} c={c} calc={calcs[c] ?? "none"} options={numeric(c, fields) ? NUM_CALCS : ANY_CALCS} label={colMeta(c, fields).label} value={(k) => compute(k, c, tasks, fields, values)} onPick={(k) => onCalc(c, k)} />
      ))}
    </div>
  );
}

function CalcCell({ c, calc, options, label, value, onPick }: { c: Col; calc: Calc; options: Calc[]; label: string; value: (k: Calc) => string; onPick: (k: Calc) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" data-col={c} aria-label={`Calculate ${label}`} className={cn("w-fit max-w-full truncate whitespace-nowrap rounded px-1.5 py-0.5 text-left hover:bg-card", calc === "none" ? "text-muted-foreground/0 group-hover/calc:text-muted-foreground" : "font-medium text-foreground")}>
          {calc === "none" ? "Calculate" : ["filled", "empty", "pct"].includes(calc) ? value(calc) : <><span className="mr-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">{CALC_LABEL[calc]}</span>{value(calc)}</>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {(["none", ...options] as Calc[]).map((k) => (
          <button key={k} type="button" onClick={() => { onPick(k); setOpen(false); }} className={cn("flex w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent", calc === k && "font-semibold text-primary")}>
            {CALC_LABEL[k]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Floating bar while tasks are selected: change many at once. */
export function BulkBar({ list, selected, onClear }: { list: WorkListDetail; selected: number[]; onClear: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!selected.length) return null;
  const run = async (label: string, fn: (id: number) => Promise<unknown>) => {
    setBusy(true);
    let ok = 0;
    for (const id of selected) {
      try { await fn(id); ok++; } catch { /* keep going */ }
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: workKeys.tasks(list.id) });
    qc.invalidateQueries({ queryKey: ["work", "my"] });
    qc.invalidateQueries({ queryKey: ["work", "tree"] });
    if (ok === selected.length) toast.success(`${label}: ${ok} ${ok === 1 ? "task" : "tasks"}`);
    else toast.error(`${label}: ${ok} of ${selected.length} updated (you may not have access to the rest)`);
  };
  const update = (label: string, body: TaskInput) => run(label, (id) => workApi.updateTask(id, body));
  const btn = "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-white/85 hover:bg-white/10 hover:text-white disabled:opacity-50";
  return (
    <div role="toolbar" aria-label="Bulk actions" className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-xl bg-forest px-2 py-1.5 text-forest-foreground shadow-[0_18px_40px_-12px_rgb(11_42_31/0.6)] dark:bg-card dark:text-foreground dark:ring-1 dark:ring-border">
      <span className="px-2 text-[13px] font-semibold">{selected.length} selected</span>
      <span aria-hidden className="mx-1 h-5 w-px bg-white/20" />
      <StatusPicker statuses={list.statuses} value={null} onChange={(id) => update("Status changed", { statusId: id })}>
        <button type="button" disabled={busy} className={btn}><CircleDot className="h-3.5 w-3.5" /> Status</button>
      </StatusPicker>
      <AssigneePicker members={list.members} value={[]} onChange={(ids) => update("Assignees set", { assigneeIds: ids })}>
        <button type="button" disabled={busy} className={btn}><Users className="h-3.5 w-3.5" /> Assignees</button>
      </AssigneePicker>
      <PriorityPicker value={null} onChange={(p) => update("Priority set", { priority: p })}>
        <button type="button" disabled={busy} className={btn}><Flag className="h-3.5 w-3.5" /> Priority</button>
      </PriorityPicker>
      <DatePicker label="Due date" value={null} onChange={(iso) => update("Due date set", { dueDate: iso })}>
        <button type="button" disabled={busy} className={btn}><CalendarDays className="h-3.5 w-3.5" /> Due date</button>
      </DatePicker>
      <button type="button" disabled={busy} onClick={() => window.confirm(`Archive ${selected.length} ${selected.length === 1 ? "task" : "tasks"}?`) && run("Archived", (id) => workApi.archiveTask(id)).then(onClear)} className={btn}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-white/20" />
      <button type="button" aria-label="Clear selection" onClick={onClear} className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
  );
}
