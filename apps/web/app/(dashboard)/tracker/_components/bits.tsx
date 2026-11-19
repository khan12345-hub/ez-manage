"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, MonitorDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { userName, type TrackerUser } from "@/services/tracker.api";
import { fmtDay, shiftDay, todayKey } from "../_lib/tracker";

export const glass = "rounded-[24px] border border-white/70 bg-white/70 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";

const TINTS = ["#047857", "#2563eb", "#b45309", "#7c3aed", "#be185d", "#0e7490", "#4d7c0f"];
export function Avatar({ user, size = 32, className }: { user: TrackerUser | null | undefined; size?: number; className?: string }) {
  const name = userName(user);
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const tint = TINTS[(user?.id ?? 0) % TINTS.length];
  return user?.avatarUrl
    ? <img src={user.avatarUrl} alt="" className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
    : <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)} style={{ width: size, height: size, fontSize: size * 0.38, background: tint }}>{initials}</span>;
}

/** activity % as one green bar (magnitude: one hue, the number beside it) */
export function ActivityBar({ pct, className, showValue = true }: { pct: number; className?: string; showValue?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Activity" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full bg-[#047857] transition-[width] duration-500 dark:bg-[#059669]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </span>
      {showValue && <span className="w-9 text-right text-[11.5px] tabular-nums text-muted-foreground">{pct}%</span>}
    </span>
  );
}

export function StatusDot({ on }: { on: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5" aria-label={on ? "Working now" : "Not tracking"}>
      {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#059669] opacity-60" />}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", on ? "bg-[#059669]" : "bg-muted-foreground/40")} />
    </span>
  );
}

export function DayPicker({ day, onDay }: { day: string; onDay: (d: string) => void }) {
  const isToday = day === todayKey();
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Previous day" onClick={() => onDay(shiftDay(day, -1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
      <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] font-medium">
        <span className="hidden md:inline">{fmtDay(day, { weekday: "short" })}</span>
        <input type="date" value={day} max={todayKey()} onChange={(e) => e.target.value && onDay(e.target.value)} aria-label="Day" className="bg-transparent outline-none [color-scheme:light] dark:[color-scheme:dark]" />
      </label>
      <button type="button" aria-label="Next day" disabled={isToday} onClick={() => onDay(shiftDay(day, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      {!isToday && <button type="button" onClick={() => onDay(todayKey())} className="h-9 rounded-xl border border-border bg-card px-3 text-[12.5px] font-semibold hover:bg-accent">Today</button>}
    </div>
  );
}

export function PersonPicker({ people, value, onChange, allowAll }: { people: TrackerUser[]; value: number | null; onChange: (id: number | null) => void; allowAll?: boolean }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-2.5 text-[13px]">
      <span className="text-muted-foreground">Person</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} aria-label="Person" className="max-w-[200px] bg-transparent font-medium outline-none">
        {allowAll && <option value="">Everyone</option>}
        {people.map((p) => <option key={p.id} value={p.id}>{userName(p)}</option>)}
      </select>
    </label>
  );
}

/** shown where there is no tracked time yet: how to get the desktop app going */
export function InstallHint({ ws, compact }: { ws: string; compact?: boolean }) {
  return (
    <div className={cn(glass, "flex flex-col items-center px-6 text-center", compact ? "py-8" : "py-14")}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0369a1]/10 text-[#0369a1] dark:text-[#38bdf8]"><MonitorDown className="h-6 w-6" /></span>
      <p className="mt-3 text-[16px] font-semibold">No tracked time here yet</p>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">Time, screenshots and activity come from the EZ Tracker desktop app. Install it on your computer, pair it with a code, agree to what it records, then press Start.</p>
      <Link href={`/tracker/${ws}/me`} className="mt-4 flex h-10 items-center gap-1.5 rounded-xl bg-forest px-4 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Download className="h-4 w-4" /> Get the desktop app</Link>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "late" }) {
  return (
    <div className={cn(glass, "px-4 py-3.5")}>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-[26px] font-bold leading-none tracking-tight tabular-nums", tone === "late" && "text-[#dc2626] dark:text-[#f87171]")}>{value}</p>
      {sub && <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
