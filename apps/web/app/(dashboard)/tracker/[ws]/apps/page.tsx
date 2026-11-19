"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, trackerApi } from "@/services/tracker.api";
import { useTrackerWs } from "../../_lib/tracker";
import { InstallHint, PersonPicker, glass } from "../../_components/bits";

const RANGES = [["today", "Today", 0], ["7", "7 days", 6], ["30", "30 days", 29]] as const;

/** time per app / site: one series, so plain horizontal bars with the value beside each */
function Bars({ rows, label, icon: Icon, empty }: { rows: { name: string; seconds: number }[]; label: string; icon: typeof Globe; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.seconds));
  const total = rows.reduce((n, r) => n + r.seconds, 0);
  return (
    <section aria-label={label} className={cn(glass, "p-5")}>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold"><Icon className="h-4 w-4 text-muted-foreground" />{label}</h2>
      {!rows.length ? <p className="py-8 text-center text-[12.5px] text-muted-foreground">{empty}</p> : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.name} title={`${r.name}: ${hm(r.seconds)} (${Math.round((r.seconds / Math.max(1, total)) * 100)}%)`}>
              <div className="flex items-baseline gap-2 text-[13px]"><span className="min-w-0 flex-1 truncate font-medium">{r.name}</span><span className="tabular-nums text-muted-foreground">{hm(r.seconds)}</span><span className="w-10 text-right text-[11.5px] tabular-nums text-muted-foreground">{Math.round((r.seconds / Math.max(1, total)) * 100)}%</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#2563eb] transition-[width] duration-500 dark:bg-[#3b82f6]" style={{ width: `${(r.seconds / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TrackerApps() {
  const { ws, ov } = useTrackerWs();
  const [range, setRange] = useState<(typeof RANGES)[number][0]>("7");
  const [userId, setUserId] = useState<number | null>(null);
  const days = RANGES.find((r) => r[0] === range)![2];
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const { data: live = [] } = useQuery({ queryKey: ["tracker", ws, "live"], queryFn: () => trackerApi.live(ws), enabled: !!ws && !!ov?.canSeeOthers });
  const { data, isLoading } = useQuery({ queryKey: ["tracker", ws, "apps", range, userId], queryFn: () => trackerApi.apps(ws, from, to, userId ?? undefined), enabled: !!ws });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Range" className="flex rounded-xl border border-border bg-card p-0.5 text-[12.5px]">
          {RANGES.map(([k, l]) => <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)} className={cn("rounded-lg px-3 py-1.5 font-medium", range === k ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
        </div>
        {ov?.canSeeOthers && live.length > 0 && <PersonPicker people={live.map((r) => r.user)} value={userId} onChange={setUserId} allowAll />}
      </div>
      {isLoading ? <div className="h-72 animate-pulse rounded-[24px] bg-muted" /> : !data?.apps.length ? <InstallHint ws={ws} compact /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Bars label="Apps" icon={AppWindow} rows={data.apps.map((a) => ({ name: a.app, seconds: a.seconds }))} empty="No apps recorded." />
          <Bars label="Websites" icon={Globe} rows={data.urls.map((u) => ({ name: u.url, seconds: u.seconds }))} empty={ov?.settings.trackUrls ? "No websites recorded in this range." : "Website tracking is off. A manager can turn it on in Settings."} />
        </div>
      )}
      <p className="text-[12px] text-muted-foreground">Only the app in front and how long it stayed there are recorded. Website names come from the browser window title, and only when website tracking is on.</p>
    </div>
  );
}
