"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayOf, type WorkListDetail, type WorkTask } from "@/services/work.api";
import { StatusGlyph } from "./primitives";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Month calendar of tasks by due date. */
export function CalendarView({ list, tasks, onOpenTask }: { list: WorkListDetail; tasks: WorkTask[]; onOpenTask: (uid: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const statusOf = (t: WorkTask) => list.statuses.find((s) => s.id === t.statusId);

  const { cells, byDay } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    const byDay = new Map<string, WorkTask[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const k = dayOf(t.dueDate).toDateString();
      byDay.set(k, [...(byDay.get(k) ?? []), t]);
    }
    return { cells, byDay };
  }, [cursor, tasks]);

  const todayKey = new Date().toDateString();
  const undated = tasks.filter((t) => !t.dueDate && !t.parentId);
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04)]">
        <header className="flex items-center justify-between px-4 py-3">
          <h2 className="font-serif text-[24px] font-normal leading-none">
            {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Today</button>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="grid grid-cols-7 border-t border-border bg-table-head">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px border-t border-border bg-border">
          {cells.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const key = d.toDateString();
            const items = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div key={key} className={cn("flex min-h-[104px] flex-col gap-1 p-1.5", inMonth ? "bg-card" : "bg-muted/40", isToday && "bg-primary/[0.06]")}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium", isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/60")}>
                  {d.getDate()}
                </span>
                {items.slice(0, 3).map((t) => {
                  const st = statusOf(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpenTask(t.uid)}
                      title={t.name}
                      className={cn("flex items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[11.5px] font-medium hover:brightness-95", t.completedAt && "line-through opacity-60")}
                      style={{ background: `${st?.color ?? "#9CA3AF"}1c`, color: "inherit" }}
                    >
                      <StatusGlyph status={st} size={9} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  );
                })}
                {items.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - 3} more</span>}
              </div>
            );
          })}
        </div>
      </section>

      <aside className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-serif text-[19px] font-normal leading-none">No due date</h3>
        <p className="mt-1 text-xs text-muted-foreground">{undated.length} {undated.length === 1 ? "task" : "tasks"}</p>
        <ul className="mt-3 space-y-1">
          {undated.slice(0, 30).map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onOpenTask(t.uid)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                <StatusGlyph status={statusOf(t)} size={12} />
                <span className="truncate">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
