"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { WorkListDetail, WorkTask, WorkUser } from "@/services/work.api";
import { Avatar } from "./primitives";
import { useUpdateTask } from "./hooks";

const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toDay = (iso: string) => dayStart(new Date(iso));
const iso = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 17)).toISOString();
const diffDays = (a: Date, b: Date) => Math.round((+dayStart(b) - +dayStart(a)) / DAY);

/**
 * Gantt / Timeline: each task is a bar from its start to its due date. Drag a bar to move it,
 * drag its right edge to change the due date. Timeline groups the bars by person.
 */
export function GanttView({ list, tasks, onOpenTask, groupByPerson = false }: { list: WorkListDetail; tasks: WorkTask[]; onOpenTask: (uid: string) => void; groupByPerson?: boolean }) {
  const update = useUpdateTask(list.id, list.statuses);
  const [zoom, setZoom] = useState<"day" | "week">("day");
  const W = zoom === "day" ? 34 : 12;
  const today = dayStart(new Date());
  const dated = tasks.filter((t) => t.startDate || t.dueDate);
  const undated = tasks.filter((t) => !t.startDate && !t.dueDate);
  const span = (t: WorkTask) => { const s = toDay(t.startDate ?? t.dueDate!); const e = toDay(t.dueDate ?? t.startDate!); return e < s ? { s: e, e: s } : { s, e }; };
  const range = useMemo(() => {
    let min = new Date(+today - 7 * DAY), max = new Date(+today + 35 * DAY);
    for (const t of dated) { const { s, e } = span(t); if (s < min) min = new Date(+s - 3 * DAY); if (e > max) max = new Date(+e + 7 * DAY); }
    if (zoom === "week") { min = new Date(+min - ((min.getDay() + 6) % 7) * DAY); }
    return { min, days: diffDays(min, max) + 1 };
  }, [tasks, zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  const x = (d: Date) => diffDays(range.min, d) * W;

  const groups = useMemo(() => {
    if (!groupByPerson) return [{ key: "all", user: null as WorkUser | null, tasks: dated }];
    const map = new Map<number | "none", { key: string; user: WorkUser | null; tasks: WorkTask[] }>();
    for (const t of dated) {
      const owners = t.assignees.length ? t.assignees : [null];
      for (const u of owners) { const k = u ? u.id : "none"; const g = map.get(k) ?? { key: String(k), user: u, tasks: [] }; g.tasks.push(t); map.set(k, g); }
    }
    return [...map.values()].sort((a, b) => (a.user ? 0 : 1) - (b.user ? 0 : 1) || (a.user?.firstName ?? "").localeCompare(b.user?.firstName ?? ""));
  }, [dated, groupByPerson]); // eslint-disable-line react-hooks/exhaustive-deps

  // drag: move the whole bar or (edge) only the due date
  const drag = useRef<{ t: WorkTask; mode: "move" | "end"; x0: number; s: Date; e: Date } | null>(null);
  const [preview, setPreview] = useState<{ id: number; s: Date; e: Date } | null>(null);
  const onDown = (ev: React.PointerEvent, t: WorkTask, mode: "move" | "end") => {
    if (!list.access?.canEdit) return;
    ev.stopPropagation(); (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    const { s, e } = span(t); drag.current = { t, mode, x0: ev.clientX, s, e }; setPreview({ id: t.id, s, e });
  };
  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const n = Math.round((ev.clientX - d.x0) / W);
    setPreview(d.mode === "move" ? { id: d.t.id, s: new Date(+d.s + n * DAY), e: new Date(+d.e + n * DAY) } : { id: d.t.id, s: d.s, e: new Date(Math.max(+d.s, +d.e + n * DAY)) });
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (!d || !preview) { setPreview(null); return; }
    const moved = +preview.s !== +d.s || +preview.e !== +d.e;
    if (moved) update.mutate({ id: d.t.id, body: d.mode === "move" ? { ...(d.t.startDate ? { startDate: iso(preview.s) } : {}), dueDate: iso(preview.e) } : { dueDate: iso(preview.e) } });
    else onOpenTask(d.t.uid);
    setPreview(null);
  };

  const headers = Array.from({ length: range.days }, (_, i) => new Date(+range.min + i * DAY));
  const statusColor = (t: WorkTask) => list.statuses.find((s) => s.id === t.statusId)?.color ?? "#64748b";

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12.5px]">
        <span className="font-semibold">{groupByPerson ? "Timeline by person" : "Gantt"}</span>
        <span className="text-muted-foreground">· drag a bar to move it, drag its right edge to change the due date</span>
        <span className="flex-1" />
        <span role="group" aria-label="Zoom" className="flex rounded-md border border-border p-0.5">
          {(["day", "week"] as const).map((z) => <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)} className={cn("rounded px-2 py-0.5", zoom === z ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{z === "day" ? "Days" : "Weeks"}</button>)}
        </span>
      </div>
      <div className="flex overflow-hidden">
        {/* names */}
        <div className="w-[240px] shrink-0 border-r border-border">
          <div className="h-9 border-b border-border" />
          {groups.map((g) => (
            <div key={g.key}>
              {groupByPerson && <div className="flex h-8 items-center gap-2 bg-muted/40 px-3 text-[12.5px] font-semibold">{g.user ? <><Avatar user={g.user} size={20} />{g.user.firstName} {g.user.lastName}</> : "Unassigned"}<span className="font-normal text-muted-foreground">· {g.tasks.length}</span></div>}
              {g.tasks.map((t) => <button key={`${g.key}-${t.id}`} type="button" onClick={() => onOpenTask(t.uid)} className="flex h-9 w-full items-center gap-2 truncate border-b border-border/50 px-3 text-left text-[13px] hover:bg-accent/40"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor(t) }} /><span className={cn("truncate", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span></button>)}
            </div>
          ))}
        </div>
        {/* chart */}
        <div className="min-w-0 flex-1 overflow-x-auto" onPointerMove={onMove} onPointerUp={onUp}>
          <div style={{ width: range.days * W }} className="relative">
            <div className="flex h-9 border-b border-border">
              {headers.map((d, i) => {
                const label = zoom === "day" ? d.getDate() : d.getDay() === 1 ? d.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
                const first = d.getDate() === 1 || i === 0;
                return (
                  <div key={i} style={{ width: W }} className={cn("relative shrink-0 border-r border-border/40 text-center text-[10.5px] text-muted-foreground", (d.getDay() === 0 || d.getDay() === 6) && zoom === "day" && "bg-muted/40", +d === +today && "font-bold text-primary")}>
                    {first && zoom === "day" && <span className="absolute left-0.5 top-0 whitespace-nowrap text-[9.5px] font-semibold uppercase">{d.toLocaleDateString([], { month: "short" })}</span>}
                    <span className="absolute bottom-1 left-0 right-0 whitespace-nowrap">{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="pointer-events-none absolute bottom-0 top-9 z-10 w-0.5 bg-primary/60" style={{ left: x(today) + W / 2 }} aria-hidden />
            {groups.map((g) => (
              <div key={g.key}>
                {groupByPerson && <div className="h-8 bg-muted/40" />}
                {g.tasks.map((t) => {
                  const p = preview?.id === t.id ? preview : span(t);
                  const left = x(p.s), width = (diffDays(p.s, p.e) + 1) * W;
                  return (
                    <div key={`${g.key}-${t.id}`} className="relative h-9 border-b border-border/50">
                      <div role="button" tabIndex={0} aria-label={`${t.name}: ${p.s.toLocaleDateString()} to ${p.e.toLocaleDateString()}`}
                        onPointerDown={(ev) => onDown(ev, t, "move")} onKeyDown={(ev) => ev.key === "Enter" && onOpenTask(t.uid)}
                        title={`${t.name} · ${p.s.toLocaleDateString()} → ${p.e.toLocaleDateString()}`}
                        className={cn("absolute top-1.5 flex h-6 cursor-grab items-center overflow-hidden rounded-md px-2 text-[11.5px] font-medium text-white shadow-sm active:cursor-grabbing", t.completedAt && "opacity-60")}
                        style={{ left, width: Math.max(W, width), background: statusColor(t) }}>
                        <span className="truncate">{zoom === "day" || width > 60 ? t.name : ""}</span>
                        <span onPointerDown={(ev) => onDown(ev, t, "end")} aria-hidden className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/15" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {undated.length > 0 && (
        <div className="border-t border-border px-3 py-2 text-[12.5px] text-muted-foreground">
          <span className="font-medium">No dates ({undated.length}):</span>{" "}
          {undated.slice(0, 12).map((t, i) => <span key={t.id}>{i > 0 && ", "}<button type="button" onClick={() => onOpenTask(t.uid)} className="text-foreground hover:text-primary hover:underline">{t.name}</button></span>)}
          {undated.length > 12 && ` and ${undated.length - 12} more`} — give them a start or due date to place them.
        </div>
      )}
    </div>
  );
}

/** Workload: each person's open tasks per day (start → due), busiest days stand out. */
export function WorkloadView({ list, tasks, onOpenTask }: { list: WorkListDetail; tasks: WorkTask[]; onOpenTask: (uid: string) => void }) {
  const [weeks, setWeeks] = useState(2);
  const [cell, setCell] = useState<{ user: number | "none"; day: number } | null>(null);
  const today = dayStart(new Date());
  const days = Array.from({ length: weeks * 7 }, (_, i) => new Date(+today + i * DAY));
  const open = tasks.filter((t) => !t.completedAt && (t.dueDate || t.startDate));
  // an overdue open task still needs doing: it counts on today
  const on = (t: WorkTask, d: Date) => { const s = toDay(t.startDate ?? t.dueDate!), e = toDay(t.dueDate ?? t.startDate!); return (+d >= +s && +d <= +e) || (+e < +today && +d === +today); };
  const people = useMemo(() => {
    const map = new Map<number | "none", { id: number | "none"; user: WorkUser | null; tasks: WorkTask[] }>();
    for (const t of open) for (const u of t.assignees.length ? t.assignees : [null]) {
      const k = u ? u.id : "none"; const g = map.get(k) ?? { id: k, user: u, tasks: [] }; g.tasks.push(t); map.set(k, g);
    }
    return [...map.values()].sort((a, b) => (a.user ? 0 : 1) - (b.user ? 0 : 1) || b.tasks.length - a.tasks.length);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const CAP = 3; // more than this many tasks on one day reads as overloaded
  const picked = cell ? people.find((p) => p.id === cell.user)?.tasks.filter((t) => on(t, days[cell.day]!)) ?? [] : [];
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12.5px]">
        <span className="font-semibold">Workload</span><span className="text-muted-foreground">· open tasks per person per day (start → due; overdue ones count today). More than {CAP} in a day is flagged.</span>
        <span className="flex-1" />
        <span role="group" aria-label="Range" className="flex rounded-md border border-border p-0.5">{[2, 4].map((w) => <button key={w} type="button" aria-pressed={weeks === w} onClick={() => setWeeks(w)} className={cn("rounded px-2 py-0.5", weeks === w ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{w} weeks</button>)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          <thead><tr><th className="sticky left-0 z-10 w-[200px] border-b border-border bg-card px-3 py-2 text-left font-medium text-muted-foreground">Person</th>
            {days.map((d, i) => <th key={i} className={cn("border-b border-l border-border/50 px-1 py-2 text-center text-[10.5px] font-medium text-muted-foreground", (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/40", i === 0 && "text-primary")}>{d.toLocaleDateString([], { weekday: "narrow" })}<br />{d.getDate()}</th>)}</tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={String(p.id)}>
                <td className="sticky left-0 z-10 border-b border-border/60 bg-card px-3 py-1.5"><span className="flex items-center gap-2">{p.user ? <><Avatar user={p.user} size={22} /><span className="truncate">{p.user.firstName} {p.user.lastName}</span></> : <span className="text-muted-foreground">Unassigned</span>}</span></td>
                {days.map((d, i) => {
                  const n = p.tasks.filter((t) => on(t, d)).length;
                  const over = n > CAP;
                  return (
                    <td key={i} className="border-b border-l border-border/50 p-0.5 text-center">
                      {n > 0 && <button type="button" onClick={() => setCell({ user: p.id, day: i })} aria-label={`${p.user ? p.user.firstName : "Unassigned"}: ${n} ${n === 1 ? "task" : "tasks"} on ${d.toLocaleDateString()}`}
                        className={cn("h-7 w-full rounded font-mono text-[12px] font-semibold", over ? "bg-destructive/15 text-destructive" : n >= CAP ? "bg-[#c27c0e]/15 text-[#8a5a08] dark:text-[#e3b25c]" : "bg-primary/10 text-primary")}>{n}</button>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!people.length && <tr><td colSpan={days.length + 1} className="px-3 py-8 text-center text-muted-foreground">No open tasks with dates in this list.</td></tr>}
          </tbody>
        </table>
      </div>
      {cell && (
        <div className="border-t border-border px-3 py-2 text-[12.5px]">
          <p className="mb-1 font-semibold">{days[cell.day]!.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} · {picked.length} {picked.length === 1 ? "task" : "tasks"} <button type="button" onClick={() => setCell(null)} className="ml-2 font-normal text-muted-foreground hover:underline">close</button></p>
          <ul className="flex flex-wrap gap-1.5">{picked.map((t) => <li key={t.id}><button type="button" onClick={() => onOpenTask(t.uid)} className="rounded-md border border-border px-2 py-0.5 hover:bg-accent">{t.name}</button></li>)}</ul>
        </div>
      )}
    </div>
  );
}
