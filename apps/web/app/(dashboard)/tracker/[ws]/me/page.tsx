"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Download, Laptop, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSENT_VERSION, trackerApi } from "@/services/tracker.api";
import { useTrackerWs } from "../../_lib/tracker";
import { glass } from "../../_components/bits";
import { ConsentText } from "../../_components/ConsentText";

const err = (e: any, m: string) => toast.error(e?.response?.data?.message?.toString?.() ?? m);
const DOWNLOAD = process.env.NEXT_PUBLIC_TRACKER_DOWNLOAD_URL;

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return <>{s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "expired"}</>;
}

export default function TrackerMe() {
  const { ws, ov } = useTrackerWs();
  const qc = useQueryClient();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { data: devices = [] } = useQuery({ queryKey: ["tracker", ws, "devices"], queryFn: () => trackerApi.devices(ws), enabled: !!ws });
  const consent = useMutation({ mutationFn: () => trackerApi.acceptConsent(ws, CONSENT_VERSION), onSuccess: () => { toast.success("Thanks. You can start tracking from the desktop app."); qc.invalidateQueries({ queryKey: ["tracker", ws, "overview"] }); }, onError: (e) => err(e, "Couldn't save that.") });
  const pair = useMutation({ mutationFn: () => trackerApi.pairCode(ws), onSuccess: setCode, onError: (e) => err(e, "Couldn't make a code.") });
  const revoke = useMutation({ mutationFn: (id: number) => trackerApi.revokeDevice(id), onSuccess: () => { toast.success("That computer is signed out"); qc.invalidateQueries({ queryKey: ["tracker", ws] }); }, onError: (e) => err(e, "Couldn't sign it out.") });
  const s = ov?.settings;

  // the Administrator can open any company without being in its EZ Tracker
  if (ov && !ov.member) {
    return (
      <section className={cn(glass, "p-6 text-center")}>
        <ShieldCheck className="mx-auto h-8 w-8 text-[#0369a1]" />
        <h2 className="mt-2 text-[16px] font-semibold">You are not tracked in this company</h2>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">You see it as the Administrator. To track your own time here, add yourself on the People page, then come back for the download and pairing code.</p>
        <a href={`/tracker/${ws}/people`} className="mt-4 inline-flex h-9 items-center rounded-xl border border-border px-3 text-[13px] font-semibold hover:bg-accent">Open People</a>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section aria-label="Consent" className={cn(glass, "p-5")}>
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", ov?.consent.acceptedAt ? "bg-[#047857]/10 text-[#047857] dark:text-[#34d399]" : "bg-[#b45309]/10 text-[#b45309] dark:text-[#fbbf24]")}><ShieldCheck className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold">What EZ Tracker records</h2>
            <p className="text-[12.5px] text-muted-foreground">{ov?.consent.acceptedAt ? `You agreed on ${new Date(ov.consent.acceptedAt).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.` : "Nothing is recorded until you agree, here or in the desktop app."}{ov && !ov.tracked ? " Your tracking is paused in this company." : ""}</p>
          </span>
          {ov && !ov.consent.acceptedAt && <button type="button" disabled={consent.isPending} onClick={() => consent.mutate()} className="flex h-10 items-center gap-1.5 rounded-xl bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{consent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} I agree</button>}
        </header>
        {s && <ConsentText shots={s.screenshotsPer10} blur={s.blur} apps={s.trackApps} urls={s.trackUrls} retention={s.retentionDays} />}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-label="Desktop app" className={cn(glass, "p-5")}>
          <h2 className="text-[16px] font-semibold">Desktop app</h2>
          <ol className="mt-3 space-y-3 text-[13px]">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">1</span>
              <span className="min-w-0 flex-1">Install EZ Tracker for Windows.{" "}
                {DOWNLOAD ? <a href={DOWNLOAD} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0369a1] px-3 font-semibold text-white"><Download className="h-4 w-4" /> Download for Windows</a>
                  : <span className="mt-1 block text-[12px] text-muted-foreground">Ask your Tracker admin for the installer.</span>}
              </span>
            </li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">2</span>
              <span className="min-w-0 flex-1">Make a pairing code and type it into the app. It works once, for 10 minutes.
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  {code ? (
                    <>
                      <span className="rounded-xl bg-[#0369a1]/[0.08] px-4 py-2 font-mono text-[22px] font-bold tracking-[0.18em] text-[#0369a1] ring-1 ring-[#0369a1]/20 dark:text-[#7dd3fc]">{code.code}</span>
                      <button type="button" onClick={() => { navigator.clipboard?.writeText(code.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => null); }} className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 font-medium hover:bg-accent">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy</button>
                      <span className="text-[12px] text-muted-foreground">expires in <Countdown until={code.expiresAt} /></span>
                    </>
                  ) : <button type="button" disabled={pair.isPending} onClick={() => pair.mutate()} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3 font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{pair.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Get a pairing code</button>}
                </span>
              </span>
            </li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">3</span><span>Read what it records, agree, pick a task and press Start. A tray icon shows whenever it is tracking.</span></li>
          </ol>
        </section>

        <section aria-label="Your computers" className={cn(glass, "p-5")}>
          <h2 className="text-[16px] font-semibold">Your computers</h2>
          {!devices.length ? <p className="py-8 text-center text-[12.5px] text-muted-foreground">No computer is paired yet.</p> : (
            <ul className="mt-3 divide-y divide-border/70">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06]"><Laptop className="h-4 w-4 text-muted-foreground" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{d.name}</span><span className="block text-[11.5px] text-muted-foreground">{[d.os, d.appVersion && `v${d.appVersion}`, d.lastSeenAt && `last seen ${new Date(d.lastSeenAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`].filter(Boolean).join(" · ")}</span></span>
                  <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate(d.id)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-medium text-[#dc2626] hover:bg-[#dc2626]/[0.06] disabled:opacity-50 dark:text-[#f87171]"><Trash2 className="h-3.5 w-3.5" /> Sign out</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
