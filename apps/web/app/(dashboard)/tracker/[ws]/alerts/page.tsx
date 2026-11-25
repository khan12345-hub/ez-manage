"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { AlarmClock, Activity, CheckCircle2, ChevronLeft, ChevronRight, Clock4, Hourglass, Siren, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, trackerApi, userName } from "@/services/tracker.api";
import { keyOf, useTrackerWs, weekStart } from "../../_lib/tracker";
import { Avatar, InstallHint, glass } from "../../_components/bits";
import { StatTile, fade, stagger } from "../../_components/charts";

type Flag = { id: string; user: any; reason: string; detail: string; high: boolean; icon: any };

/** Managers: who to look at — low activity, high idle, repeated late starts, or no tracking this week.
 *  All computed in the browser from the week's timesheet + attendance (no secrets, no new endpoint). */
export default function TrackerAlerts() {
  const { ws, ov } = useTrackerWs();
  const reduced = useReducedMotion();
  const [start, setStart] = useState(() => weekStart());
  const end = useMemo(() => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7), [start]);
  const thisWeek = keyOf(start) === keyOf(weekStart());
  const shift = (n: number) => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + n * 7));

  const { data: people = [] } = useQuery({ queryKey: ["tracker", ws, "people"], queryFn: () => trackerApi.people(ws), enabled: !!ws && !!ov?.isManager });
  const { data: timesheet = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "timesheet", "alerts", keyOf(start)], queryFn: () => trackerApi.timesheet(ws, start, end), enabled: !!ws && !!ov?.isManager });
  const { data: attendance } = useQuery({ queryKey: ["tracker", ws, "attendance", "alerts", keyOf(start)], queryFn: () => trackerApi.attendance(ws, start, end), enabled: !!ws && !!ov?.isManager });

  const flags = useMemo<Flag[]>(() => {
    const out: Flag[] = [];
    const ts = new Map(timesheet.map((r) => [r.user.id, r]));
    const lateBy = new Map<number, number>();
    for (const r of attendance?.rows ?? []) if (r.late) lateBy.set(r.user.id, (lateBy.get(r.user.id) ?? 0) + 1);
    for (const p of people.filter((x) => x.tracked)) {
      const t = ts.get(p.user.id);
      const total = t?.total ?? 0;
      const active = t?.activeTotal ?? 0;
      if (total === 0) { out.push({ id: `nt-${p.user.id}`, user: p.user, high: true, reason: "No tracked time this week", detail: "Tracking is on for them, but nothing was recorded.", icon: UserX }); continue; }
      const pct = total ? Math.round((active / total) * 100) : 0;
      if (total >= 2 * 3600 && pct < 35) out.push({ id: `la-${p.user.id}`, user: p.user, high: pct < 20, reason: `Low activity — ${pct}%`, detail: `${hm(active)} active of ${hm(total)} tracked (keyboard & mouse).`, icon: Activity });
      const late = lateBy.get(p.user.id) ?? 0;
      if (late >= 2) out.push({ id: `lt-${p.user.id}`, user: p.user, high: late >= 4, reason: `Late ${late} day${late > 1 ? "s" : ""}`, detail: "Started after the day's start time by more than 5 minutes.", icon: AlarmClock });
      const maxDay = Math.max(0, ...Object.values(t?.days ?? {}).map((d) => d.seconds));
      if (maxDay > 10 * 3600) out.push({ id: `od-${p.user.id}`, user: p.user, high: false, reason: "Very long day", detail: `${hm(maxDay)} tracked in a single day — check for overwork.`, icon: Hourglass });
    }
    return out.sort((a, b) => (b.high ? 1 : 0) - (a.high ? 1 : 0));
  }, [people, timesheet, attendance]);

  const high = flags.filter((f) => f.high).length;

  if (ov && !ov.isManager) return <div className={cn(glass, "p-10 text-center text-[13px] text-muted-foreground")}>Only Tracker admins and the Administrator can see unusual activity.</div>;

  return (
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      <motion.div variants={fade} className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dc2626]/10 text-[#dc2626]"><Siren className="h-4 w-4" /></span>
        <h1 className="text-[16px] font-semibold">Unusual activity</h1>
        <span className="flex-1" />
        <button type="button" aria-label="Previous week" onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[150px] text-center text-[13.5px] font-semibold">Week of {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <button type="button" aria-label="Next week" disabled={thisWeek} onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </motion.div>

      <motion.div variants={stagger} className="grid grid-cols-3 gap-3">
        <StatTile icon={Siren} label="To check" value={flags.length} alarm={!!high} tone="#dc2626" sub={high ? `${high} high priority` : "all low priority"} />
        <StatTile icon={Clock4} label="People tracked" value={people.filter((p) => p.tracked).length} sub="with tracking on" />
        <StatTile icon={Activity} label="Avg activity" value={`${(() => { const tot = timesheet.reduce((n, r) => n + r.total, 0); const act = timesheet.reduce((n, r) => n + r.activeTotal, 0); return tot ? Math.round((act / tot) * 100) : 0; })()}%`} tone="#047857" sub="team, this week" />
      </motion.div>

      {isLoading ? <div className="h-64 animate-pulse rounded-[24px] bg-muted" /> : !people.some((p) => p.tracked) ? <InstallHint ws={ws} compact /> : (
        <motion.section variants={fade} aria-label="Alerts" className={cn(glass, "overflow-hidden")}>
          <header className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10"><Siren className="h-4 w-4 text-[#dc2626]" /><h2 className="flex-1 text-[14px] font-semibold">Alerts</h2><span className="font-mono text-[11.5px] text-muted-foreground">{flags.length}</span></header>
          {!flags.length ? (
            <p className="flex items-center justify-center gap-2 py-14 text-center text-[13px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-[#047857]" /> Nothing unusual this week.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {flags.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar user={f.user} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13.5px]"><strong className="font-semibold">{userName(f.user)}</strong><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", f.high ? "bg-[#dc2626]/10 text-[#dc2626]" : "bg-[#b45309]/10 text-[#b45309]")}><f.icon className="h-3 w-3" />{f.reason}</span></span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">{f.detail}</span>
                  </span>
                  <Link href={`/tracker/${ws}/people/${f.user.id}`} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium hover:bg-accent">View</Link>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      )}
      <p className="px-1 text-[11.5px] text-muted-foreground">Heads-up, not proof. Low activity can mean meetings, calls or offline work. Open a person to see their days, apps and screenshots before deciding anything.</p>
    </motion.div>
  );
}
