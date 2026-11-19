"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { EyeOff, ImageOff, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, trackerApi, userName, type TrackerLiveRow } from "@/services/tracker.api";
import { todayKey, useTrackerWs } from "../_lib/tracker";
import { ActivityBar, Avatar, InstallHint, Stat, StatusDot, glass } from "../_components/bits";

function Since({ iso }: { iso: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  return <>{hm(Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)))}</>;
}

function PersonCard({ r, ws }: { r: TrackerLiveRow; ws: string }) {
  const on = r.status === "working";
  const href = `/tracker/${ws}/screenshots?user=${r.user.id}&day=${todayKey()}`;
  return (
    <div className={cn(glass, "flex h-full flex-col overflow-hidden", on && "ring-1 ring-[#059669]/25")}>
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
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><StatusDot on={on} />{on ? <>Working · <Since iso={r.since!} /></> : "Not tracking"}</span>
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

export default function TrackerLive() {
  const reduced = useReducedMotion();
  const { ws, ov } = useTrackerWs();
  const { data = [], isLoading } = useQuery({ queryKey: ["tracker", ws, "live"], queryFn: () => trackerApi.live(ws), refetchInterval: 30_000, enabled: !!ws });
  const working = data.filter((r) => r.status === "working");
  const total = data.reduce((n, r) => n + r.todaySeconds, 0);
  const tracked = data.filter((r) => r.todaySeconds > 0);
  const avg = tracked.length ? Math.round(tracked.reduce((n, r) => n + r.todayActivity * r.todaySeconds, 0) / Math.max(1, total)) : 0;
  const team = !!ov?.canSeeOthers;

  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-[24px] bg-muted" />)}</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={team ? "Working now" : "Status"} value={team ? `${working.length}/${data.length}` : working.length ? "Working" : "Stopped"} sub={team ? "people tracking right now" : working[0]?.task?.name ?? "Start from the desktop app"} />
        <Stat label={team ? "Team time today" : "Your time today"} value={hm(total)} sub={team ? `${tracked.length} ${tracked.length === 1 ? "person" : "people"} tracked today` : "kept time (idle discarded)"} />
        <Stat label="Average activity" value={`${avg}%`} sub="keyboard & mouse, weighted by time" />
        <Stat label="Screenshots" value={ov ? (ov.settings.screenshotsPer10 ? `${ov.settings.screenshotsPer10} / 10 min` : "Off") : "…"} sub={ov ? `kept ${ov.settings.retentionDays ? `${ov.settings.retentionDays} days` : "forever"}${ov.settings.blur ? " · blurred" : ""}` : ""} />
      </div>

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
