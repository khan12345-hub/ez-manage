"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, trackerApi, userName } from "@/services/tracker.api";
import { fmtDay, fmtTime, keyOf, useTrackerWs, weekStart } from "../../_lib/tracker";
import { Avatar, InstallHint, Stat, glass } from "../../_components/bits";

export default function TrackerAttendance() {
  const { ws } = useTrackerWs();
  const [start, setStart] = useState(() => weekStart());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const { data, isLoading } = useQuery({ queryKey: ["tracker", ws, "attendance", keyOf(start)], queryFn: () => trackerApi.attendance(ws, start, end), enabled: !!ws });
  const rows = data?.rows ?? [];
  const late = rows.filter((r) => r.late);
  const thisWeek = keyOf(start) === keyOf(weekStart());
  const shift = (n: number) => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + n * 7));
  const avgStart = rows.length ? new Date(rows.reduce((n, r) => { const d = new Date(r.firstStart); return n + d.getHours() * 60 + d.getMinutes(); }, 0) / rows.length * 60_000 + new Date(2000, 0, 1).getTime()) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Previous week" onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[170px] text-center text-[14px] font-semibold">Week of {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <button type="button" aria-label="Next week" disabled={thisWeek} onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        <span className="flex-1" />
        {data && <span className="text-[12.5px] text-muted-foreground">Day starts at <b className="text-foreground">{data.dayStart}</b> · late after 5 minutes</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Days worked" value={rows.length} sub="person-days this week" />
        <Stat label="Late starts" value={late.length} tone={late.length ? "late" : undefined} sub={late.length ? `${late.length} of ${rows.length} days` : "everyone on time"} />
        <Stat label="Average start" value={avgStart ? avgStart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"} sub="first Start of the day" />
      </div>
      {isLoading ? <div className="h-72 animate-pulse rounded-[24px] bg-muted" /> : !rows.length ? <InstallHint ws={ws} compact /> : (
        <div className={cn(glass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead className="bg-black/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.03]">
                <tr><th className="px-4 py-2.5">Day</th><th className="px-3 py-2.5">Person</th><th className="px-3 py-2.5">Started</th><th className="px-3 py-2.5">Stopped</th><th className="px-3 py-2.5 text-right">Tracked</th><th className="px-4 py-2.5" aria-label="Late" /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.user.id}-${r.day}`} className="border-t border-border/60">
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
        </div>
      )}
    </div>
  );
}
