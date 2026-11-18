"use client";

/* The one month calendar used everywhere in Work (list, space/folder, channel, DM). */

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalItem = { id: number; uid: string; name: string; dueDate: string | null; completedAt: string | null; color?: string | null };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** the 6-week window shown for a month (Sunday first) */
export function monthWindow(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return { days, from: days[0]!, to: new Date(days[41]!.getFullYear(), days[41]!.getMonth(), days[41]!.getDate() + 1) };
}

export function CalendarGrid({ month, onMonth, items, onOpen, toolbar, aside }: { month: Date; onMonth: (m: Date) => void; items: CalItem[]; onOpen: (uid: string) => void; toolbar?: React.ReactNode; aside?: React.ReactNode }) {
  const { days } = useMemo(() => monthWindow(month), [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const t of items) if (t.dueDate) { const k = key(new Date(t.dueDate)); m.set(k, [...(m.get(k) ?? []), t]); }
    return m;
  }, [items]);
  const today = key(new Date());
  const shift = (n: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const overdue = (t: CalItem) => !t.completedAt && !!t.dueDate && new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className={cn("grid min-h-0 gap-4", aside && "xl:grid-cols-[1fr_260px]")}>
      <section aria-label="Calendar" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04)]">
        <header className="flex flex-wrap items-center gap-3 px-4 py-3">
          <h2 aria-live="polite" className="text-[18px] font-semibold tracking-tight">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          {toolbar}
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => { const d = new Date(); onMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="h-8 rounded-lg border border-border px-3 text-[12.5px] font-semibold hover:bg-muted">Today</button>
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </header>
        {/* phones: an agenda (days that have tasks) instead of a 7-column grid */}
        <ul aria-label="Agenda" className="divide-y divide-border border-t border-border sm:hidden">
          {days.filter((d) => d.getMonth() === month.getMonth() && ((byDay.get(key(d)) ?? []).length || key(d) === today)).map((d) => {
            const list = byDay.get(key(d)) ?? [];
            return (
              <li key={key(d)} className={cn("flex gap-3 px-4 py-2.5", key(d) === today && "bg-primary/[0.05]")}>
                <span className="w-11 shrink-0 text-center">
                  <span className="block text-[10.5px] font-semibold uppercase text-muted-foreground">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold", key(d) === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
                </span>
                <span className="min-w-0 flex-1 space-y-1 pt-0.5">
                  {!list.length && <span className="block py-1 text-[12.5px] text-muted-foreground">Nothing due</span>}
                  {list.map((t) => (
                    <button key={t.id} type="button" onClick={() => onOpen(t.uid)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium", t.completedAt && "line-through opacity-60")} style={{ background: `${overdue(t) ? "#dc2626" : t.color ?? "#9CA3AF"}1a` }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: overdue(t) ? "#dc2626" : t.color ?? "#9CA3AF" }} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-t border-border bg-muted/40">
              {WEEKDAYS.map((d) => <div key={d} className="py-2 text-center text-[11.5px] font-semibold text-muted-foreground">{d}</div>)}
            </div>
            <div role="grid" className="grid grid-cols-7 gap-px border-t border-border bg-border">
              {days.map((d) => {
                const k = key(d);
                const list = byDay.get(k) ?? [];
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = k === today;
                return (
                  <div key={k} role="gridcell" aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} className={cn("flex min-h-[108px] flex-col gap-1 p-1.5", inMonth ? "bg-card" : "bg-muted/30", isToday && "bg-primary/[0.05]")}>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium", isToday ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/60")}>{d.getDate()}</span>
                    {list.slice(0, 3).map((t) => (
                      <button key={t.id} type="button" onClick={() => onOpen(t.uid)} title={t.name}
                        className={cn("flex items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-[11.5px] font-medium transition hover:brightness-95", t.completedAt && "line-through opacity-60")}
                        style={{ background: `${overdue(t) ? "#dc2626" : t.color ?? "#9CA3AF"}1a` }}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: overdue(t) ? "#dc2626" : t.color ?? "#9CA3AF" }} />
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} more</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {aside}
    </div>
  );
}
