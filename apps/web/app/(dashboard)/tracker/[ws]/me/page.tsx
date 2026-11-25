"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Activity, CalendarCheck, Check, Clock4, Copy, Download, Laptop, Loader2, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { CONSENT_VERSION, hm, trackerApi, userName, type TrackerUser } from "@/services/tracker.api";
import { keyOf, todayKey, useTrackerWs, weekStart } from "../../_lib/tracker";
import { glass } from "../../_components/bits";
import { BarLegend, HoursBars, Ring, StatTile, fade, stagger } from "../../_components/charts";
import { ConsentText } from "../../_components/ConsentText";

const err = (e: any, m: string) => toast.error(e?.response?.data?.message?.toString?.() ?? m);
// A hosted URL if set, otherwise the API serves the installer from TRACKER_INSTALLER_PATH on the server.
const DOWNLOAD = process.env.NEXT_PUBLIC_TRACKER_DOWNLOAD_URL || (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/tracker/desktop/download` : undefined);

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return <>{s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "expired"}</>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://staging-apimanage.ezify.pk/api";

/** Managers: make a zero-touch deploy code for one person — bake it into their silent installer so it
 *  connects to them on first run, with no pair screen. The code is long-lived and revocable. */
function DeployCodes({ ws }: { ws: string }) {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery({ queryKey: ["tracker", ws, "people"], queryFn: () => trackerApi.people(ws), enabled: !!ws });
  const { data: codes = [] } = useQuery({ queryKey: ["tracker", ws, "deploy-codes"], queryFn: () => trackerApi.deployCodes(ws), enabled: !!ws });
  const [picked, setPicked] = useState<string>("");
  const [made, setMade] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState("");
  const gen = useMutation({
    mutationFn: (userId?: number) => trackerApi.createDeployCode(ws, userId),
    onSuccess: (r, userId) => { setMade({ name: userId ? userName(people.find((p) => p.user.id === userId)?.user ?? null) : "your organization — assign each computer to a person later", code: r.code }); qc.invalidateQueries({ queryKey: ["tracker", ws, "deploy-codes"] }); },
    onError: (e) => err(e, "Couldn't make a deploy code."),
  });
  const revoke = useMutation({ mutationFn: (id: number) => trackerApi.revokeDeployCode(ws, id), onSuccess: () => qc.invalidateQueries({ queryKey: ["tracker", ws, "deploy-codes"] }) });
  const copy = (text: string, k: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(k); setTimeout(() => setCopied(""), 1500); }).catch(() => null); };
  // PowerShell (Windows default) and bash (Git Bash / macOS / Linux). Run from the repo folder.
  const buildPs = (code: string) => `$env:EZT_DEPLOY_CODE="${code}"; $env:EZT_SILENT="1"; $env:EZT_DEFAULT_API="${API_BASE}"; pnpm --filter ./apps/tracker-desktop dist:win:silent`;
  const buildSh = (code: string) => `EZT_DEPLOY_CODE=${code} EZT_SILENT=1 EZT_DEFAULT_API=${API_BASE} pnpm --filter ./apps/tracker-desktop dist:win:silent`;

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border bg-black/[0.015] p-4 dark:bg-white/[0.02]">
      <h3 className="text-[14px] font-semibold">Zero-touch deploy code <span className="ml-1 rounded bg-[#334155]/10 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">no pair screen</span></h3>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Make a code for one person and bake it into their silent installer — it connects to <b>them</b> on first run, with nothing to type on the computer. The code is long-lived; revoke it any time.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Person" className="h-9 min-w-[180px] rounded-xl border border-border bg-background px-2 text-[13px]">
          <option value="">Choose a person…</option>
          {people.map((p) => <option key={p.user.id} value={p.user.id}>{userName(p.user)} · {p.user.email}</option>)}
        </select>
        <button type="button" disabled={!picked || gen.isPending} onClick={() => gen.mutate(Number(picked))} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#334155] px-3 text-[13px] font-semibold text-white disabled:opacity-50">{gen.isPending && <Loader2 className="h-4 w-4 animate-spin" />} For this person</button>
        <span className="text-[12px] text-muted-foreground">or</span>
        <button type="button" disabled={gen.isPending} onClick={() => gen.mutate(undefined)} title="One installer for everyone — assign each computer to a person afterwards (Hubstaff-style)" className="flex h-9 items-center gap-1.5 rounded-xl border border-[#334155]/40 px-3 text-[13px] font-semibold text-[#334155] disabled:opacity-50 dark:text-[#cbd5e1]">Organization token</button>
      </div>

      {made && (
        <div className="mt-3 rounded-xl border border-[#334155]/25 bg-[#334155]/[0.05] p-3">
          <p className="text-[12.5px]">Deploy code for <b>{made.name}</b> (shown once — keep it safe):</p>
          <div className="mt-1.5 flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-background px-2.5 py-1.5 font-mono text-[12.5px]">{made.code}</code><button type="button" onClick={() => copy(made.code, "code")} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-[12px] hover:bg-accent">{copied === "code" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
          <p className="mt-2.5 text-[12px] text-muted-foreground">Build that person's silent installer <b>from the repo folder</b> on a dev machine:</p>
          <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">Windows · PowerShell</p>
          <div className="mt-1 flex items-start gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-background px-2.5 py-2 font-mono text-[11.5px] whitespace-pre">{buildPs(made.code)}</code><button type="button" onClick={() => copy(buildPs(made.code), "ps")} className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[12px] hover:bg-accent">{copied === "ps" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">Git Bash · macOS · Linux</p>
          <div className="mt-1 flex items-start gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-background px-2.5 py-2 font-mono text-[11.5px] whitespace-pre">{buildSh(made.code)}</code><button type="button" onClick={() => copy(buildSh(made.code), "sh")} className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[12px] hover:bg-accent">{copied === "sh" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
        </div>
      )}

      {codes.length > 0 && (
        <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
              <span className="min-w-0 flex-1"><span className="font-medium">{c.org ? "Organization token" : userName(c.user)}</span><span className="block text-[11px] text-muted-foreground">{c.lastUsedAt ? `last deployed ${new Date(c.lastUsedAt).toLocaleDateString()}` : "not used yet"}</span></span>
              <button type="button" onClick={() => revoke.mutate(c.id)} className="rounded-lg border border-border px-2 py-1 text-[11.5px] text-[#dc2626] hover:bg-[#dc2626]/[0.06]">Revoke</button>
            </li>
          ))}
        </ul>
      )}

      <UnassignedDevices ws={ws} people={people} />
    </div>
  );
}

/** Hubstaff-style: computers that enrolled with an org token, waiting to be assigned to a person. */
function UnassignedDevices({ ws, people }: { ws: string; people: { user: TrackerUser }[] }) {
  const qc = useQueryClient();
  const { data: devices = [] } = useQuery({ queryKey: ["tracker", ws, "unassigned"], queryFn: () => trackerApi.unassignedDevices(ws), enabled: !!ws, refetchInterval: 15_000 });
  const assign = useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) => trackerApi.assignDevice(ws, id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tracker", ws, "unassigned"] }); toast.success("Computer assigned — it starts tracking within a minute."); },
    onError: (e) => err(e, "Couldn't assign."),
  });
  if (!devices.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-[#b45309]/30 bg-[#b45309]/[0.05] p-3">
      <p className="text-[13px] font-semibold text-[#92400e] dark:text-[#fbbf24]">{devices.length} computer{devices.length === 1 ? "" : "s"} waiting to be assigned</p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">These enrolled with the organization token. Assign each one to a person — it starts tracking them within a minute.</p>
      <ul className="mt-2.5 space-y-2">
        {devices.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-2">
            <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[13px] font-medium"><Laptop className="h-3.5 w-3.5 text-muted-foreground" />{d.name}</span><span className="block text-[11px] text-muted-foreground">{[d.os, d.appVersion && `v${d.appVersion}`, d.lastSeenAt && `seen ${new Date(d.lastSeenAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`].filter(Boolean).join(" · ")}</span></span>
            <select aria-label="Assign to" defaultValue="" onChange={(e) => { if (e.target.value) assign.mutate({ id: d.id, userId: Number(e.target.value) }); }} className="h-9 rounded-lg border border-border bg-background px-2 text-[13px]">
              <option value="">Assign to…</option>
              {people.map((p) => <option key={p.user.id} value={p.user.id}>{userName(p.user)}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** my own hours: ring + today/week/month + last-7-days bars (built from my timesheet) */
function MyActivity({ ws }: { ws: string }) {
  const { user } = useAuth();
  const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), []);
  const to = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }, []);
  const { data = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "timesheet", "me", keyOf(monthStart)], queryFn: () => trackerApi.timesheet(ws, monthStart, to), enabled: !!ws });
  const mine = useMemo(() => data.find((r) => r.user.id === user?.id) ?? (data.length === 1 ? data[0] : undefined), [data, user?.id]);

  const stats = useMemo(() => {
    const dayMap = mine?.days ?? {};
    const tk = todayKey();
    const wk = weekStart();
    const inWeek = (k: string) => { const [y, m, d] = k.split("-").map(Number); const dt = new Date(y!, (m ?? 1) - 1, d ?? 1); return dt >= wk; };
    const today = dayMap[tk] ?? { seconds: 0, active: 0, activity: 0 };
    let weekTracked = 0, weekActive = 0;
    for (const [k, v] of Object.entries(dayMap)) if (inWeek(k)) { weekTracked += v.seconds; weekActive += v.active; }
    const bars = Array.from({ length: 7 }, (_, i) => { const d = new Date(wk.getFullYear(), wk.getMonth(), wk.getDate() + i); const c = dayMap[keyOf(d)]; return { key: keyOf(d), label: d.toLocaleDateString("en-US", { weekday: "short" }), sub: String(d.getDate()), tracked: c?.seconds ?? 0, active: c?.active ?? 0 }; });
    return { today, weekTracked, weekActive, weekPct: weekTracked ? Math.round((weekActive / weekTracked) * 100) : 0, monthTracked: mine?.total ?? 0, monthActive: mine?.activeTotal ?? 0, bars };
  }, [mine]);

  if (isLoading) return <div className="h-52 animate-pulse rounded-[24px] bg-muted" />;
  const nothing = !stats.monthTracked;

  return (
    <motion.section variants={fade} aria-label="Your activity" className={cn(glass, "p-5")}>
      <header className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#b45309] dark:text-[#fbbf24]" /><h2 className="text-[16px] font-semibold">Your activity</h2><span className="text-[12.5px] text-muted-foreground">· this week</span></header>
      {nothing ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">No tracked time yet this month. Pair the desktop app below and press Start — your hours and activity show up here.</p>
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center justify-center gap-5 lg:w-[280px] lg:flex-col">
            <Ring pct={stats.weekPct} label="Activity" />
            <div className="space-y-1 text-[12.5px] text-muted-foreground lg:text-center">
              <p>Keyboard & mouse,<br className="hidden lg:block" /> averaged across this week.</p>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <motion.div variants={stagger} className="grid grid-cols-3 gap-2.5">
              <StatTile icon={Clock4} label="Today" value={hm(stats.today.seconds)} sub={`${stats.today.activity}% active`} />
              <StatTile icon={CalendarCheck} label="This week" value={hm(stats.weekTracked)} sub={`${hm(stats.weekActive)} active`} tone="#2563eb" />
              <StatTile icon={Activity} label="This month" value={hm(stats.monthTracked)} sub={`${hm(stats.monthActive)} active`} tone="#b45309" />
            </motion.div>
            <div>
              <div className="mb-2.5 flex items-center justify-between"><p className="text-[12px] font-medium text-muted-foreground">Hours this week</p><BarLegend /></div>
              <HoursBars data={stats.bars} highlight={todayKey()} height={120} />
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}

export default function TrackerMe() {
  const { ws, ov } = useTrackerWs();
  const reduced = useReducedMotion();
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
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      <MyActivity ws={ws} />

      <motion.section variants={fade} aria-label="Consent" className={cn(glass, "p-5")}>
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", ov?.consent.acceptedAt ? "bg-[#047857]/10 text-[#047857] dark:text-[#34d399]" : "bg-[#b45309]/10 text-[#b45309] dark:text-[#fbbf24]")}><ShieldCheck className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold">What EZ Tracker records</h2>
            <p className="text-[12.5px] text-muted-foreground">{ov?.consent.acceptedAt ? `You agreed on ${new Date(ov.consent.acceptedAt).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}.` : "Nothing is recorded until you agree, here or in the desktop app."}{ov && !ov.tracked ? " Your tracking is paused in this company." : ""}</p>
          </span>
          {ov && !ov.consent.acceptedAt && <button type="button" disabled={consent.isPending} onClick={() => consent.mutate()} className="flex h-10 items-center gap-1.5 rounded-xl bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{consent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} I agree</button>}
        </header>
        {s && <ConsentText shots={s.screenshotsPer10} blur={s.blur} apps={s.trackApps} urls={s.trackUrls} retention={s.retentionDays} />}
      </motion.section>

      <motion.div variants={fade} className="grid gap-4 xl:grid-cols-2">
        <section aria-label="Desktop app" className={cn(glass, "p-5")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[16px] font-semibold">Desktop app</h2>
            {DOWNLOAD && <a href={DOWNLOAD} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#0369a1] px-3.5 text-[13px] font-semibold text-white hover:bg-[#075985]"><Download className="h-4 w-4" /> Download for Windows</a>}
          </div>
          <ol className="mt-3 space-y-3 text-[13px]">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">1</span>
              <span className="min-w-0 flex-1">Install EZ Tracker for Windows — use the <b>Download for Windows</b> button above.</span>
            </li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">2</span>
              <span className="min-w-0 flex-1">Easiest: in the app press <b>“Connect with my account”</b> — it opens here, you confirm, and it links on its own. Or make a pairing code and type it in. A code works once, for 10 minutes.
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
      </motion.div>

      {ov?.isManager && (
        <motion.section variants={fade} aria-label="Silent (unattended) setup" className={cn(glass, "p-5")}>
          <header className="mb-3 flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#334155]/10 text-[#334155] dark:text-[#cbd5e1]"><ShieldCheck className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <h2 className="text-[16px] font-semibold">Silent (unattended) setup <span className="ml-1 rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground dark:bg-white/10">managers</span></h2>
              <p className="text-[12.5px] text-muted-foreground">For organisation-owned computers where staff have been told monitoring is on — runs with no window and tracks automatically on login, like Hubstaff's Silent App.</p>
            </span>
          </header>
          <p className="text-[13px] text-muted-foreground">There is no separate “silent” download — it's the <b>same EZ Tracker installer</b>, launched once with a flag:</p>
          <ol className="mt-3 space-y-2.5 text-[13px]">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">1</span>
              <span className="min-w-0 flex-1">Install EZ Tracker on the computer{DOWNLOAD ? <> — <a href={DOWNLOAD} className="font-semibold text-[#0369a1] underline dark:text-[#7dd3fc]">download</a></> : ""}, and make sure tracking is turned on for that person (People → add them).</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">2</span>
              <span className="min-w-0 flex-1">Launch it <b>once</b> with <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px] dark:bg-white/10">--silent</code>, e.g. a shortcut to:
                <code className="mt-1.5 block overflow-x-auto rounded-lg bg-black/[0.05] px-3 py-2 font-mono text-[12px] dark:bg-white/[0.06]">"C:\Program Files\EZ Tracker\EZ Tracker.exe" --silent</code>
              </span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[12px] font-bold dark:bg-white/10">3</span>
              <span className="min-w-0 flex-1">The Pair screen shows <b>this one time</b> — press “Connect with my account” or paste a pairing code. The moment it's paired the window closes for good; after that it auto-starts on login, auto-accepts the monitoring policy and tracks on its own.</span></li>
          </ol>
          <DeployCodes ws={ws} />
          <p className="mt-3 rounded-xl bg-[#b45309]/[0.07] px-3.5 py-2.5 text-[12px] text-[#92400e] dark:text-[#fbbf24]">It is <b>not covert</b> — it keeps the “EZ Tracker” name in the process list, Installed Programs and the Windows start-up list. Only use it for people who have been told their work activity is monitored.</p>
        </motion.section>
      )}
    </motion.div>
  );
}
