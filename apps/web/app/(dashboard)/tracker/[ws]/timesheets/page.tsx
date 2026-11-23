"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, BarChart3, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock4, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, trackerApi, userName } from "@/services/tracker.api";
import { keyOf, todayKey, useTrackerWs, weekStart } from "../../_lib/tracker";
import { Avatar, InstallHint, glass } from "../../_components/bits";
import { BarLegend, HoursBars, StatTile, fade, stagger } from "../../_components/charts";

type Period = "week" | "month";

export default function TrackerTimesheets() {
  const { ws } = useTrackerWs();
  const reduced = useReducedMotion();
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(() => weekStart());
  const [open, setOpen] = useState<number | null>(null);

  // range: a Mon–Sun week, or the whole calendar month
  const { start, end, days, label } = useMemo(() => {
    if (period === "month") {
      const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
      const n = Math.round((e.getTime() - s.getTime()) / 86_400_000);
      return { start: s, end: e, days: Array.from({ length: n }, (_, i) => new Date(s.getFullYear(), s.getMonth(), 1 + i)), label: s.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
    }
    const s = anchor;
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
    const d = Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
    const a = d[0]!, z = d[6]!, mon = (x: Date) => x.toLocaleDateString("en-US", { month: "short" });
    return { start: s, end: e, days: d, label: a.getMonth() === z.getMonth() ? `${mon(a)} ${a.getDate()} – ${z.getDate()}, ${z.getFullYear()}` : `${mon(a)} ${a.getDate()} – ${mon(z)} ${z.getDate()}, ${z.getFullYear()}` };
  }, [period, anchor]);

  const { data = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "timesheet", period, keyOf(start)], queryFn: () => trackerApi.timesheet(ws, start, end), enabled: !!ws });

  const now = period === "month" ? keyOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) === keyOf(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) : keyOf(anchor) === keyOf(weekStart());
  const shift = (n: number) => setAnchor((s) => period === "month" ? new Date(s.getFullYear(), s.getMonth() + n, 1) : new Date(s.getFullYear(), s.getMonth(), s.getDate() + n * 7));
  const setPer = (p: Period) => { setPeriod(p); setAnchor(p === "month" ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : weekStart()); setOpen(null); };
  const today = todayKey();

  // per-day team totals (tracked + active) for the chart
  const bars = days.map((d) => {
    const k = keyOf(d);
    let tracked = 0, active = 0;
    for (const r of data) { const c = r.days[k]; if (c) { tracked += c.seconds; active += c.active; } }
    return { key: k, label: period === "month" ? String(d.getDate()) : d.toLocaleDateString("en-US", { weekday: "short" }), sub: period === "week" ? String(d.getDate()) : undefined, tracked, active };
  });
  const grand = data.reduce((n, r) => n + r.total, 0);
  const activeGrand = data.reduce((n, r) => n + r.activeTotal, 0);
  const avgActivity = grand ? Math.round((activeGrand / grand) * 100) : 0;
  const peopleTracked = data.filter((r) => r.total > 0).length;
  const max = Math.max(1, ...data.flatMap((r) => Object.values(r.days).map((d) => d.seconds)));
  const ranked = [...data].sort((a, b) => b.total - a.total);
  const dayTotals = days.map((d) => data.reduce((n, r) => n + (r.days[keyOf(d)]?.seconds ?? 0), 0));

  return (
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      <motion.div variants={fade} className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Period" className="flex rounded-xl border border-border bg-card p-0.5 text-[12.5px]">
          {(["week", "month"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={period === p} onClick={() => setPer(p)} className={cn("rounded-lg px-3 py-1.5 font-medium capitalize", period === p ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{p}</button>
          ))}
        </div>
        <span className="flex-1 sm:flex-none" />
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous" onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[160px] text-center text-[14px] font-semibold">{label}</span>
          <button type="button" aria-label="Next" disabled={now} onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          {!now && <button type="button" onClick={() => setAnchor(period === "month" ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : weekStart())} className="h-9 rounded-xl border border-border bg-card px-3 text-[12.5px] font-semibold hover:bg-accent">{period === "month" ? "This month" : "This week"}</button>}
        </div>
      </motion.div>

      {isLoading ? <div className="h-80 animate-pulse rounded-[24px] bg-muted" /> : !grand ? <InstallHint ws={ws} compact /> : (
        <>
          <motion.div variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={Clock4} label="Tracked" value={hm(grand)} sub={period === "month" ? "this month" : "this week"} />
            <StatTile icon={Activity} label="Active time" value={hm(activeGrand)} sub="idle time removed" tone="#2563eb" />
            <StatTile icon={BarChart3} label="Avg activity" value={`${avgActivity}%`} sub="keyboard & mouse" tone="#047857" />
            <StatTile icon={Users} label="People tracked" value={peopleTracked} sub={`of ${data.length} in EZ Tracker`} tone="#b45309" />
          </motion.div>

          <motion.section variants={fade} aria-label="Hours per day" className={cn(glass, "p-5")}>
            <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Hours per day <span className="font-normal text-muted-foreground">· tracked vs active</span></h2>
              <BarLegend />
            </header>
            <div className={period === "month" ? "overflow-x-auto" : ""}>
              <div style={period === "month" ? { minWidth: Math.max(520, days.length * 26) } : undefined}>
                <HoursBars data={bars} highlight={bars.find((b) => b.key === today) ? today : undefined} />
              </div>
            </div>
          </motion.section>

          <motion.div variants={fade} className={cn(glass, "overflow-hidden")}>
            {period === "week" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[13px]">
                  <thead className="bg-black/[0.02] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.03]">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Person</th>
                      {days.map((d) => <th key={keyOf(d)} className={cn("px-2 py-2.5 text-center", keyOf(d) === today && "text-primary")}>{d.toLocaleDateString("en-US", { weekday: "short" })}<span className="block text-[10.5px] font-medium normal-case tracking-normal">{d.getDate()}</span></th>)}
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((r) => (
                      <Fragment key={r.user.id}>
                        <tr className="border-t border-border/60">
                          <td className="px-4 py-2.5">
                            <button type="button" onClick={() => setOpen(open === r.user.id ? null : r.user.id)} aria-expanded={open === r.user.id} className="flex items-center gap-2.5 text-left">
                              <Avatar user={r.user} size={28} /><span className="max-w-[160px] truncate font-medium">{userName(r.user)}</span>
                              {open === r.user.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          </td>
                          {days.map((d) => {
                            const k = keyOf(d); const c = r.days[k];
                            return (
                              <td key={k} className="px-1.5 py-1.5 text-center">
                                {c?.seconds ? (
                                  <Link href={`/tracker/${ws}/screenshots?user=${r.user.id}&day=${k}`} title={`${hm(c.seconds)} · ${c.activity}% activity`} className="group block rounded-xl px-1.5 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]">
                                    <span className="block font-semibold tabular-nums">{hm(c.seconds)}</span>
                                    <span className="mx-auto mt-1 block h-1 w-12 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[#047857] dark:bg-[#059669]" style={{ width: `${(c.seconds / max) * 100}%` }} /></span>
                                    <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{c.activity}%</span>
                                  </Link>
                                ) : <span className="text-muted-foreground/50">—</span>}
                              </td>
                            );
                          })}
                          <td className="px-4 text-right font-bold tabular-nums">{hm(r.total)}</td>
                        </tr>
                        {open === r.user.id && (
                          <tr className="bg-black/[0.015] dark:bg-white/[0.02]">
                            <td colSpan={9} className="px-4 py-3">
                              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">By task this week</p>
                              {!r.tasks.length ? <p className="text-[12.5px] text-muted-foreground">No time this week.</p> : (
                                <ul className="grid gap-1.5 sm:grid-cols-2">
                                  {r.tasks.map((t) => (
                                    <li key={`${t.uid}-${t.name}`} className="flex items-center gap-3 text-[12.5px]">
                                      <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[#047857] dark:bg-[#059669]" style={{ width: `${(t.seconds / Math.max(1, r.total)) * 100}%` }} /></span>
                                      <span className="w-14 text-right tabular-nums text-muted-foreground">{hm(t.seconds)}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                  {data.length > 1 && (
                    <tfoot>
                      <tr className="border-t border-border bg-black/[0.02] font-semibold dark:bg-white/[0.03]">
                        <td className="px-4 py-2.5">Everyone</td>
                        {dayTotals.map((s, i) => <td key={i} className="px-2 text-center tabular-nums">{s ? hm(s) : "—"}</td>)}
                        <td className="px-4 text-right tabular-nums">{hm(grand)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              /* month: a ranked totals list (31 columns would not fit), tracked vs active per person */
              <ul className="divide-y divide-border/60">
                <li className="flex items-center gap-3 bg-black/[0.02] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.03]">
                  <span className="flex-1">Person</span><span className="hidden w-[46%] sm:block">Tracked vs active</span><span className="w-16 text-right">Active</span><span className="w-16 text-right">Total</span>
                </li>
                {ranked.map((r) => {
                  const pct = r.total ? Math.round((r.activeTotal / r.total) * 100) : 0;
                  return (
                    <li key={r.user.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                      <span className="flex min-w-0 flex-1 items-center gap-2.5"><Avatar user={r.user} size={28} /><span className="min-w-0"><span className="block truncate font-medium">{userName(r.user)}</span><span className="block text-[11px] text-muted-foreground">{pct}% activity</span></span></span>
                      <span className="hidden w-[46%] sm:block"><span className="block h-2.5 overflow-hidden rounded-full bg-[#047857]/12 dark:bg-[#059669]/20"><span className="block h-full rounded-full bg-[#047857] dark:bg-[#059669]" style={{ width: `${r.total ? (r.activeTotal / Math.max(1, ...ranked.map((x) => x.total))) * 100 : 0}%` }} /></span></span>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">{hm(r.activeTotal)}</span>
                      <span className="w-16 text-right font-bold tabular-nums">{hm(r.total)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </>
      )}
      <p className="text-[12px] text-muted-foreground">Hours are tracked time minus idle time that was discarded and 10-minute blocks whose screenshot was deleted. Time on a Company Work task also shows in that task and in Work timesheets.</p>
    </motion.div>
  );
}
