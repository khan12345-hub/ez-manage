"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoSource } from "@/services/ceo-tower.api";

/* Validated pairs (dataviz validator): light #047857 / #c27c0e — all pass;
   dark #0e9b6b / #c98318 — CVD 7.8 (floor band) so a second cue is always on:
   bars sit side by side, the second line is dashed, plus legend and a table view. */
const C = { a: "var(--trend-a)", b: "var(--trend-b)" };
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

/**
 * Portfolio → Trends: is it getting better or worse?
 *  - weekly tasks created vs completed (last 8 weeks, from the tasks themselves)
 *  - daily open vs overdue (from Executive Hub's daily snapshots — it fills in from the first day)
 */
export function TrendsCard({ source, company }: { source: CeoSource; company: string | null }) {
  const { data, isLoading } = useQuery({ queryKey: ["ceo-tower", "trends", source, company], queryFn: () => ceoApi.trends(source, company), refetchInterval: 10 * 60_000 });
  const [table, setTable] = useState(false);

  return (
    <section aria-label="Trends" className="rounded-2xl border border-border bg-card [--trend-a:#047857] [--trend-b:#c27c0e] dark:[--trend-a:#0e9b6b] dark:[--trend-b:#c98318]">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><TrendingUp className="h-4.5 w-4.5" /></span>
        <span className="min-w-[200px] flex-1"><span className="block font-serif text-[19px] leading-tight">Trends</span><span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Getting better or worse?</span></span>
        <button type="button" aria-pressed={table} onClick={() => setTable((t) => !t)} className="rounded-md border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">{table ? "Show charts" : "Show table"}</button>
      </header>
      {isLoading || !data ? <div className="m-5 h-48 animate-pulse rounded-xl bg-muted" /> : table ? (
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <table className="w-full text-[12.5px]"><caption className="mb-1 text-left text-[12px] font-semibold text-muted-foreground">Tasks per week</caption>
            <thead><tr className="text-left text-[11px] text-muted-foreground"><th className="py-1 font-medium">Week of</th><th className="font-medium">Created</th><th className="font-medium">Completed</th></tr></thead>
            <tbody>{data.weeks.map((w) => <tr key={w.start} className="border-t border-border/60"><td className="py-1">{fmtDay(w.start)}</td><td className="font-mono">{w.created}</td><td className="font-mono">{w.completed}</td></tr>)}</tbody></table>
          <table className="w-full text-[12.5px]"><caption className="mb-1 text-left text-[12px] font-semibold text-muted-foreground">Open and overdue per day</caption>
            <thead><tr className="text-left text-[11px] text-muted-foreground"><th className="py-1 font-medium">Day</th><th className="font-medium">Open</th><th className="font-medium">Overdue</th></tr></thead>
            <tbody>{data.days.map((d) => <tr key={d.day} className="border-t border-border/60"><td className="py-1">{fmtDay(d.day)}</td><td className="font-mono">{d.open}</td><td className="font-mono">{d.overdue}</td></tr>)}{!data.days.length && <tr><td colSpan={3} className="py-2 text-muted-foreground">Starts filling in today.</td></tr>}</tbody></table>
        </div>
      ) : (
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <WeeklyBars weeks={data.weeks} />
          <DailyLines days={data.days} />
        </div>
      )}
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <span className="flex gap-3 text-[11.5px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? <svg width="16" height="6" aria-hidden><line x1="0" y1="3" x2="16" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray="4 3" /></svg> : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </span>
  );
}

const W = 520, H = 190, PAD = { l: 30, r: 8, t: 10, b: 24 };
const niceMax = (v: number) => { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };

function Axis({ max }: { max: number }) {
  const ticks = [0, max / 2, max];
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  return <g>{ticks.map((t) => <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" strokeDasharray={t ? "2 3" : undefined} /><text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{Math.round(t)}</text></g>)}</g>;
}

function WeeklyBars({ weeks }: { weeks: { start: string; created: number; completed: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...weeks.flatMap((w) => [w.created, w.completed])));
  const band = (W - PAD.l - PAD.r) / weeks.length;
  const bw = Math.min(14, (band - 10) / 2);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const h = hover !== null ? weeks[hover] : null;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[12.5px] font-semibold">Tasks per week · last 8 weeks</span><Legend items={[{ label: "Created", color: C.b }, { label: "Completed", color: C.a }]} /></figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tasks created and completed per week">
          <Axis max={max} />
          {weeks.map((w, i) => {
            const x0 = PAD.l + i * band + (band - (bw * 2 + 2)) / 2;
            return (
              <g key={w.start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={PAD.l + i * band} y={PAD.t} width={band} height={H - PAD.t - PAD.b} fill="transparent" />
                {hover === i && <rect x={PAD.l + i * band + 2} y={PAD.t} width={band - 4} height={H - PAD.t - PAD.b} className="fill-muted/60" rx="4" />}
                <path d={bar(x0, y(w.created), bw, H - PAD.b)} fill={C.b} />
                <path d={bar(x0 + bw + 2, y(w.completed), bw, H - PAD.b)} fill={C.a} />
                <text x={PAD.l + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">{fmtDay(w.start)}</text>
              </g>
            );
          })}
        </svg>
        {h && <Tip x={(PAD.l + (hover! + 0.5) * band) / W} title={`Week of ${fmtDay(h.start)}`} rows={[["Created", h.created, C.b], ["Completed", h.completed, C.a]]} />}
      </div>
    </figure>
  );
}

/** a bar with a 4px rounded top, flat on the baseline */
function bar(x: number, top: number, w: number, base: number) {
  const hgt = Math.max(0, base - top);
  if (hgt < 1) return "";
  const r = Math.min(4, hgt, w / 2);
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

function DailyLines({ days }: { days: { day: string; open: number; overdue: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (days.length < 2) {
    return (
      <figure className="min-w-0">
        <figcaption className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[12.5px] font-semibold">Open vs overdue · daily</span><Legend items={[{ label: "Open", color: C.a }, { label: "Overdue", color: C.b, dashed: true }]} /></figcaption>
        <div className="flex h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center text-[12.5px] text-muted-foreground">
          {days[0] ? <><strong className="text-foreground">Today: {days[0].open} open · {days[0].overdue} overdue</strong><span className="mt-1">Executive Hub records these every day — the line fills in from tomorrow.</span></> : "Executive Hub starts recording these today."}
        </div>
      </figure>
    );
  }
  const max = niceMax(Math.max(1, ...days.flatMap((d) => [d.open, d.overdue])));
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * i) / (days.length - 1);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const line = (k: "open" | "overdue") => days.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[k])}`).join(" ");
  const h = hover !== null ? days[hover] : null;
  const labelEvery = Math.ceil(days.length / 6);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[12.5px] font-semibold">Open vs overdue · daily</span><Legend items={[{ label: "Open", color: C.a }, { label: "Overdue", color: C.b, dashed: true }]} /></figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Open and overdue tasks per day"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(days.length - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (days.length - 1))))); }}
          onMouseLeave={() => setHover(null)}>
          <Axis max={max} />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="stroke-muted-foreground/50" strokeWidth="1" />}
          <path d={line("open")} fill="none" stroke={C.a} strokeWidth="2" strokeLinejoin="round" />
          <path d={line("overdue")} fill="none" stroke={C.b} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
          {hover !== null && (["open", "overdue"] as const).map((k) => <circle key={k} cx={x(hover)} cy={y(days[hover]?.[k] ?? 0)} r="4" fill={k === "open" ? C.a : C.b} className="stroke-card" strokeWidth="2" />)}
          {days.map((d, i) => (i % labelEvery === 0 || i === days.length - 1) && <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">{fmtDay(d.day)}</text>)}
        </svg>
        {h && <Tip x={x(hover!) / W} title={fmtDay(h.day)} rows={[["Open", h.open, C.a], ["Overdue", h.overdue, C.b]]} />}
      </div>
    </figure>
  );
}

function Tip({ x, title, rows }: { x: number; title: string; rows: [string, number, string][] }) {
  return (
    <div className={cn("pointer-events-none absolute top-1 z-10 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[12px] shadow-lg", x > 0.6 ? "-translate-x-full" : "")} style={{ left: `calc(${x * 100}% ${x > 0.6 ? "- 10px" : "+ 10px"})` }}>
      <p className="font-semibold">{title}</p>
      {rows.map(([l, v, c]) => <p key={l} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{l} <strong className="ml-auto pl-3 font-mono">{v}</strong></p>)}
    </div>
  );
}
