"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Camera, Clock4, EyeOff, ImageOff, ListChecks, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, hm, trackerApi, userName, type TrackerCompanyLive, type TrackerLiveRow } from "@/services/tracker.api";
import { todayKey, useTrackerWs } from "../_lib/tracker";
import { ActivityBar, Avatar, InstallHint, glass } from "../_components/bits";
import { StatTile, stagger } from "../_components/charts";

function Since({ iso }: { iso: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  return <>{hm(Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)))}</>;
}

function PersonCard({ r, ws }: { r: TrackerLiveRow; ws: string }) {
  const on = r.status !== "offline";
  const away = r.status === "away";
  const href = `/tracker/${ws}/screenshots?user=${r.user.id}&day=${todayKey()}`;
  return (
    <div className={cn(glass, "flex h-full flex-col overflow-hidden", away ? "ring-1 ring-[#d97706]/30" : on && "ring-1 ring-[#059669]/25")}>
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden bg-gradient-to-br from-black/[0.04] to-black/[0.02] dark:from-white/[0.04] dark:to-white/[0.02]" aria-label={`${userName(r.user)}: screenshots today`}>
        {r.lastShot?.url ? (
          <>
            <img src={r.lastShot.url} alt="" loading="lazy" className={cn("h-full w-full object-cover object-top transition duration-500 hover:scale-[1.03]", r.lastShot.blurred && "blur-[2px]")} />
            <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">{new Date(r.lastShot.takenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{r.lastShot.blurred ? " · blurred" : ""}</span>
          </>
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 text-[12px] text-muted-foreground">{r.todaySeconds ? <EyeOff className="h-5 w-5" /> : <ImageOff className="h-5 w-5" />}{r.todaySeconds ? "No screenshot to show" : "No screenshots today"}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2.5">
          <Avatar user={r.user} size={36} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-semibold">{userName(r.user)}</span>{r.me && <span className="rounded bg-black/[0.05] px-1.5 text-[10px] font-semibold text-muted-foreground dark:bg-white/10">You</span>}</span>
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><span className={cn("h-2 w-2 shrink-0 rounded-full", away ? "bg-[#d97706]" : on ? "bg-[#059669]" : "bg-muted-foreground/40")} />{away ? <span className="font-medium text-[#b45309] dark:text-[#fbbf24]">Away{r.awaySince ? <> · <Since iso={r.awaySince} /></> : null}</span> : on ? <>Working · <Since iso={r.since!} /></> : "Not tracking"}</span>
          </span>
          <span className="text-right"><span className="block text-[18px] font-bold leading-none tabular-nums">{hm(r.todaySeconds)}</span><span className="text-[11px] text-muted-foreground">today</span></span>
        </div>
        <p className="mt-3 flex min-h-[20px] items-center gap-1.5 truncate text-[12.5px]">
          {on && (r.task || r.project) ? <><ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate font-medium">{r.task?.name ?? r.project}</span></> : <span className="text-muted-foreground">{on ? "No task picked" : " "}</span>}
        </p>
        <div className="mt-2"><p className="mb-1 text-[11px] text-muted-foreground">Activity today</p><ActivityBar pct={r.todayActivity} /></div>
      </div>
    </div>
  );
}

/** the system Administrator: who is working right now in every company */
function AllCompanies({ rows, current }: { rows: TrackerCompanyLive[]; current: string }) {
  const working = rows.reduce((n, r) => n + r.working.length, 0);
  return (
    <section aria-label="All companies" className={cn(glass, "p-4")}>
      <header className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[14px] font-semibold">All companies</h2>
        <span className="text-[12px] text-muted-foreground">{working} working now · {rows.length} companies</span>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.company.key}>
            <Link href={`/tracker/${r.company.key}`} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 ring-black/[0.05] transition hover:bg-white/70 dark:ring-white/10 dark:hover:bg-white/5", r.company.key === current && "bg-white/70 ring-[#0369a1]/30 dark:bg-white/5")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.company.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{r.company.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{SOURCE_LABEL[r.company.source]} · {hm(r.todaySeconds)} today</span>
              </span>
              <span className="flex -space-x-1.5">{r.working.slice(0, 4).map((w) => <span key={w.user.id} title={`${userName(w.user)} · working`} className="rounded-full ring-2 ring-white dark:ring-[#14181a]"><Avatar user={w.user} size={22} /></span>)}</span>
              <span className={cn("min-w-[48px] text-right text-[12px] font-semibold tabular-nums", r.working.length ? "text-[#047857] dark:text-[#34d399]" : "text-muted-foreground")}>{r.working.length}/{r.people}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TrackerLive() {
  const reduced = useReducedMotion();
  const { ws, ov } = useTrackerWs();
  const { data = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "live"], queryFn: () => trackerApi.live(ws), refetchInterval: 30_000, enabled: !!ws });
  const working = data.filter((r) => r.status === "working");
  const total = data.reduce((n, r) => n + r.todaySeconds, 0);
  const tracked = data.filter((r) => r.todaySeconds > 0);
  const avg = tracked.length ? Math.round(tracked.reduce((n, r) => n + r.todayActivity * r.todaySeconds, 0) / Math.max(1, total)) : 0;
  const team = !!ov?.canSeeOthers;
  const { data: all = [] } = useQuery({ queryKey: ["tracker", "all", "live"], queryFn: trackerApi.liveAll, refetchInterval: 30_000, enabled: !!ov?.isSystemAdmin });

  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-[24px] bg-muted" />)}</div>;
  return (
    <div className="space-y-4">
      {all.length > 1 && <AllCompanies rows={all} current={ov?.workspace?.key ?? ws} />}
      <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label={team ? "Working now" : "Status"} value={team ? `${working.length}/${data.length}` : working.length ? "Working" : "Stopped"} sub={team ? "people tracking right now" : working[0]?.task?.name ?? "Start from the desktop app"} />
        <StatTile icon={Clock4} label={team ? "Team time today" : "Your time today"} value={hm(total)} tone="#2563eb" sub={team ? `${tracked.length} ${tracked.length === 1 ? "person" : "people"} tracked today` : "kept time (idle discarded)"} />
        <StatTile icon={Activity} label="Average activity" value={`${avg}%`} tone="#047857" sub="keyboard & mouse, weighted by time" />
        <StatTile icon={Camera} label="Screenshots" value={ov ? (ov.settings.screenshotsPer10 ? `${ov.settings.screenshotsPer10} / 10 min` : "Off") : "…"} tone="#b45309" sub={ov ? `kept ${ov.settings.retentionDays ? `${ov.settings.retentionDays} days` : "forever"}${ov.settings.blur ? " · blurred" : ""}` : ""} />
      </motion.div>

      {!total && !working.length ? <InstallHint ws={ws} /> : (
        <>
          <h2 className="pt-1 text-[14px] font-semibold">{team ? "Team" : "You"} <span className="font-normal text-muted-foreground">· updates every 30 seconds</span></h2>
          <motion.ul initial={reduced ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data.map((r) => (
              <motion.li key={r.user.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
                <PersonCard r={r} ws={ws} />
              </motion.li>
            ))}
          </motion.ul>
        </>
      )}
    </div>
  );
}
