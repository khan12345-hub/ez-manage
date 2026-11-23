"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, Save, ShieldCheck, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackerApi, userName, type TrackerSettings } from "@/services/tracker.api";
import { useTrackerWs } from "../../_lib/tracker";
import { Avatar, glass } from "../../_components/bits";

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border/60 py-3.5 first:border-t-0">
      <span className="min-w-[220px] flex-1"><span className="block text-[13.5px] font-medium">{title}</span>{sub && <span className="block text-[12px] text-muted-foreground">{sub}</span>}</span>
      {children}
    </div>
  );
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn("relative h-6 w-11 rounded-full transition", on ? "bg-[#047857] dark:bg-[#059669]" : "bg-muted-foreground/30")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}
function Segs<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap rounded-xl border border-border bg-card p-0.5 text-[12.5px]">
      {options.map(([v, l]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={cn("rounded-lg px-3 py-1.5 font-medium", value === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
    </div>
  );
}

export default function TrackerSettingsPage() {
  const { ws, ov } = useTrackerWs();
  const qc = useQueryClient();
  const [s, setS] = useState<TrackerSettings | null>(null);
  useEffect(() => { if (ov && !s) setS(ov.settings); }, [ov, s]);
  const save = useMutation({
    mutationFn: (b: TrackerSettings) => trackerApi.updateSettings(ws, b),
    onSuccess: (r) => { setS(r); toast.success("Settings saved. Desktop apps pick them up within a minute."); qc.invalidateQueries({ queryKey: ["tracker", ws] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't save."),
  });
  if (ov && !ov.isManager) return <p className={cn(glass, "px-6 py-12 text-center text-[13px] text-muted-foreground")}>Only Tracker admins and the Administrator can change tracking settings.</p>;
  if (!s) return <div className="h-96 animate-pulse rounded-[24px] bg-muted" />;
  const set = <K extends keyof TrackerSettings>(k: K, v: TrackerSettings[K]) => setS((x) => (x ? { ...x, [k]: v } : x));
  const dirty = JSON.stringify(s) !== JSON.stringify(ov?.settings);

  return (
    <div className="space-y-4">
      <section aria-label="Recording" className={cn(glass, "p-5")}>
        <h2 className="mb-1 text-[16px] font-semibold">What is recorded</h2>
        <Row title="Screenshots" sub="Taken at random times inside every 10 minutes, of every screen.">
          <Segs label="Screenshots per 10 minutes" value={s.screenshotsPer10} onChange={(v) => set("screenshotsPer10", v)} options={[[0, "Off"], [1, "1"], [2, "2"], [3, "3"]]} />
        </Row>
        <Row title="Blur screenshots" sub="Blurred on the computer before upload, so text can't be read."><Toggle label="Blur screenshots" on={s.blur} onChange={(v) => set("blur", v)} /></Row>
        <Row title="Apps" sub="Which app is in front, and for how long."><Toggle label="Track apps" on={s.trackApps} onChange={(v) => set("trackApps", v)} /></Row>
        <Row title="Websites" sub="Site names from the browser's window title."><Toggle label="Track websites" on={s.trackUrls} onChange={(v) => set("trackUrls", v)} /></Row>
        <Row title="Idle after" sub="No keyboard or mouse for this long: the app asks to keep or discard that time.">
          <Segs label="Idle minutes" value={s.idleMinutes} onChange={(v) => set("idleMinutes", v)} options={[[3, "3 min"], [5, "5 min"], [10, "10 min"], [20, "20 min"]]} />
        </Row>
      </section>

      <section aria-label="Keeping and attendance" className={cn(glass, "p-5")}>
        <h2 className="mb-1 text-[16px] font-semibold">Keeping & attendance</h2>
        <Row title="Delete screenshots after" sub="Older screenshots are deleted every night. The tracked time stays.">
          <Segs label="Keep screenshots" value={s.retentionDays} onChange={(v) => set("retentionDays", v)} options={[[30, "30 days"], [60, "60 days"], [90, "90 days"], [180, "180 days"], [0, "Never"]]} />
        </Row>
        <Row title="Work day starts at" sub="A first Start more than 5 minutes later is marked late in Attendance.">
          <input type="time" value={s.dayStart} onChange={(e) => set("dayStart", e.target.value)} aria-label="Work day starts at" className="h-9 rounded-xl border border-border bg-card px-3 text-[13px] [color-scheme:light] dark:[color-scheme:dark]" />
        </Row>
      </section>

      <section aria-label="People" className={cn(glass, "flex flex-wrap items-center gap-3 p-5")}>
        <ShieldCheck className="h-5 w-5 shrink-0 text-[#0369a1]" />
        <span className="min-w-[220px] flex-1"><span className="block text-[15px] font-semibold">Who is tracked, and Tracker admins</span><span className="block text-[12.5px] text-muted-foreground">EZ Tracker has its own people for this company. Add people, pause someone&apos;s tracking or make them a Tracker admin on the People page.</span></span>
        <Link href={`/tracker/${ws}/people`} className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12.5px] font-semibold hover:bg-accent"><UsersRound className="h-4 w-4" /> Open People</Link>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate(s)} className="flex h-11 items-center gap-2 rounded-2xl bg-forest px-5 text-[13.5px] font-semibold text-forest-foreground shadow-[0_14px_30px_-14px_rgba(11,42,31,0.9)] disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </button>
      </div>
    </div>
  );
}
