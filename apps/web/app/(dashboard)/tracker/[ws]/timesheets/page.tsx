"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, trackerApi, userName } from "@/services/tracker.api";
import { keyOf, todayKey, useTrackerWs, weekStart } from "../../_lib/tracker";
import { Avatar, InstallHint, glass } from "../../_components/bits";

export default function TrackerTimesheets() {
  const { ws } = useTrackerWs();
  const [start, setStart] = useState(() => weekStart());
  const [open, setOpen] = useState<number | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), [start]);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const { data = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "timesheet", keyOf(start)], queryFn: () => trackerApi.timesheet(ws, start, end), enabled: !!ws });
  const shift = (n: number) => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + n * 7));
  const thisWeek = keyOf(start) === keyOf(weekStart());
  const today = todayKey();
  const dayTotals = days.map((d) => data.reduce((n, r) => n + (r.days[keyOf(d)]?.seconds ?? 0), 0));
  const grand = data.reduce((n, r) => n + r.total, 0);
  const max = Math.max(1, ...data.flatMap((r) => Object.values(r.days).map((d) => d.seconds)));
  const mon = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const a = days[0]!, z = days[6]!;
  const label = a.getMonth() === z.getMonth() ? `${mon(a)} ${a.getDate()} – ${z.getDate()}, ${z.getFullYear()}` : `${mon(a)} ${a.getDate()} – ${mon(z)} ${z.getDate()}, ${z.getFullYear()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Previous week" onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[180px] text-center text-[14px] font-semibold">{label}</span>
        <button type="button" aria-label="Next week" disabled={thisWeek} onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        {!thisWeek && <button type="button" onClick={() => setStart(weekStart())} className="h-9 rounded-xl border border-border bg-card px-3 text-[12.5px] font-semibold hover:bg-accent">This week</button>}
        <span className="flex-1" />
        <span className="text-[13px] text-muted-foreground">Total <b className="text-foreground tabular-nums">{hm(grand)}</b></span>
      </div>

      {isLoading ? <div className="h-80 animate-pulse rounded-[24px] bg-muted" /> : !grand ? <InstallHint ws={ws} compact /> : (
        <div className={cn(glass, "overflow-hidden")}>
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
                {data.map((r) => (
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
        </div>
      )}
      <p className="text-[12px] text-muted-foreground">Hours are tracked time minus idle time that was discarded and 10-minute blocks whose screenshot was deleted. Time on a {""}Company Work task also shows in that task and in Work timesheets.</p>
    </div>
  );
}
