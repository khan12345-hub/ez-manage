"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { AlarmClock, CalendarDays, ChevronLeft, ChevronRight, LogIn, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, trackerApi, userName, type TrackerAttendanceRow } from "@/services/tracker.api";
import { fmtDay, fmtTime, keyOf, useTrackerWs, weekStart } from "../../_lib/tracker";
import { Avatar, InstallHint, glass } from "../../_components/bits";
import { StatTile, fade, stagger } from "../../_components/charts";

export default function TrackerAttendance() {
  const { ws } = useTrackerWs();
  const reduced = useReducedMotion();
  const [start, setStart] = useState(() => weekStart());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const { data, isLoading } = useQuery({ queryKey: ["tracker", ws, "attendance", keyOf(start)], queryFn: () => trackerApi.attendance(ws, start, end), enabled: !!ws });
  const rows = data?.rows ?? [];
  const late = rows.filter((r) => r.late);
  const thisWeek = keyOf(start) === keyOf(weekStart());
  const shift = (n: number) => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + n * 7));
  const avgStart = rows.length ? new Date(rows.reduce((n, r) => { const d = new Date(r.firstStart); return n + d.getHours() * 60 + d.getMinutes(); }, 0) / rows.length * 60_000 + new Date(2000, 0, 1).getTime()) : null;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), [start]);
  const people = useMemo(() => {
    const m = new Map<number, { user: TrackerAttendanceRow["user"]; byDay: Map<string, TrackerAttendanceRow>; total: number }>();
    for (const r of rows) { const e = m.get(r.user.id) ?? { user: r.user, byDay: new Map(), total: 0 }; e.byDay.set(r.day, r); e.total += r.seconds; m.set(r.user.id, e); }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [rows]);
  const maxCell = Math.max(1, ...rows.map((r) => r.seconds));

  return (
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      <motion.div variants={fade} className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Previous week" onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[170px] text-center text-[14px] font-semibold">Week of {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <button type="button" aria-label="Next week" disabled={thisWeek} onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        {!thisWeek && <button type="button" onClick={() => setStart(weekStart())} className="h-9 rounded-xl border border-border bg-card px-3 text-[12.5px] font-semibold hover:bg-accent">This week</button>}
        <span className="flex-1" />
        {data && <span className="text-[12.5px] text-muted-foreground">Day starts at <b className="text-foreground">{data.dayStart}</b> · late after 5 minutes</span>}
      </motion.div>

      <motion.div variants={stagger} className="grid grid-cols-3 gap-3">
        <StatTile icon={Users} label="Days worked" value={rows.length} sub="person-days this week" />
        <StatTile icon={AlarmClock} label="Late starts" value={late.length} alarm={!!late.length} tone="#dc2626" sub={late.length ? `${late.length} of ${rows.length} days` : "everyone on time"} />
        <StatTile icon={LogIn} label="Average start" value={avgStart ? avgStart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"} tone="#2563eb" sub="first Start of the day" />
      </motion.div>

      {isLoading ? <div className="h-72 animate-pulse rounded-[24px] bg-muted" /> : !rows.length ? <InstallHint ws={ws} compact /> : (
        <>
          {/* heatmap: people × days, intensity by tracked time, red ring = late */}
          <motion.section variants={fade} aria-label="Week at a glance" className={cn(glass, "p-5")}>
            <header className="mb-3.5 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#047857] dark:text-[#34d399]" /><h2 className="text-[15px] font-semibold">Week at a glance</h2></header>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="mb-2 grid grid-cols-[minmax(130px,1.4fr)_repeat(7,1fr)] gap-1.5">
                  <span />
                  {days.map((d) => <span key={keyOf(d)} className="text-center text-[11px] font-medium text-muted-foreground">{d.toLocaleDateString("en-US", { weekday: "short" })}<span className="block text-[10px] opacity-70">{d.getDate()}</span></span>)}
                </div>
                <div className="space-y-1.5">
                  {people.map((p) => (
                    <div key={p.user.id} className="grid grid-cols-[minmax(130px,1.4fr)_repeat(7,1fr)] items-center gap-1.5">
                      <span className="flex min-w-0 items-center gap-2"><Avatar user={p.user} size={24} /><span className="truncate text-[12.5px] font-medium">{userName(p.user)}</span></span>
                      {days.map((d) => {
                        const r = p.byDay.get(keyOf(d));
                        if (!r) return <span key={keyOf(d)} className="aspect-[3/2] rounded-md bg-black/[0.03] dark:bg-white/[0.04]" title={`${fmtDay(keyOf(d))}: no time`} />;
                        const inten = 0.2 + 0.8 * (r.seconds / maxCell);
                        return (
                          <Link key={keyOf(d)} href={`/tracker/${ws}/screenshots?user=${p.user.id}&day=${keyOf(d)}`} title={`${fmtDay(r.day)} · ${userName(p.user)}\nStarted ${fmtTime(r.firstStart)}${r.lastEnd ? ` · Stopped ${fmtTime(r.lastEnd)}` : ""}\n${hm(r.seconds)} tracked${r.late ? ` · late ${hm(r.lateMinutes * 60)}` : ""}`}
                            className={cn("relative flex aspect-[3/2] items-center justify-center rounded-md text-[10.5px] font-semibold text-white transition hover:scale-[1.04]", r.late && "ring-2 ring-[#dc2626] ring-offset-1 ring-offset-transparent")}
                            style={{ background: `rgba(4,120,87,${inten})` }}>
                            {r.late && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#dc2626]" />}
                            <span className="opacity-95">{fmtTime(r.firstStart)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">Less <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(4,120,87,0.25)" }} /><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(4,120,87,0.55)" }} /><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "rgba(4,120,87,0.9)" }} /> More</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm ring-2 ring-[#dc2626]" /> Late start</span>
                  <span>Time shown is first Start · click a day for screenshots</span>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.div variants={fade} className={cn(glass, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead className="bg-black/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.03]">
                  <tr><th className="px-4 py-2.5">Day</th><th className="px-3 py-2.5">Person</th><th className="px-3 py-2.5">Started</th><th className="px-3 py-2.5">Stopped</th><th className="px-3 py-2.5 text-right">Tracked</th><th className="px-4 py-2.5" aria-label="Late" /></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.user.id}-${r.day}`} className="border-t border-border/60 hover:bg-accent/30">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium">{fmtDay(r.day)}</td>
                      <td className="px-3"><span className="flex items-center gap-2"><Avatar user={r.user} size={24} /><span className="truncate">{userName(r.user)}</span></span></td>
                      <td className="whitespace-nowrap px-3 tabular-nums">{fmtTime(r.firstStart)}</td>
                      <td className="whitespace-nowrap px-3 tabular-nums text-muted-foreground">{fmtTime(r.lastEnd)}</td>
                      <td className="px-3 text-right font-semibold tabular-nums">{hm(r.seconds)}</td>
                      <td className="px-4 text-right">{r.late && <span className="inline-flex items-center gap-1 rounded-full bg-[#dc2626]/10 px-2 py-0.5 text-[11.5px] font-semibold text-[#dc2626] dark:text-[#f87171]"><AlarmClock className="h-3 w-3" /> Late {hm(r.lateMinutes * 60)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
