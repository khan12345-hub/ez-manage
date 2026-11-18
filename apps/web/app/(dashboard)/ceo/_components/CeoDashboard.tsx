"use client";

/*
 * Executive Hub → Dashboard: the portfolio at a glance, animated.
 * Colours (validated, light / dark): open #047857 / #059669 · done #2563eb / #3b82f6 · overdue #dc2626 / #ef4444.
 * Overdue is a status colour: always shown with its label, never used for anything else.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { animate, motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { AlertTriangle, ArrowRight, ArrowUpRight, Building2, CheckCircle2, CircleDot, Clock3, Sparkles, TrendingDown, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi, type CeoCompany, type CeoHealth, type CeoOverview, type CeoSource } from "@/services/ceo-tower.api";
import { useTaskPopup } from "./TaskPopup";
import { AssignedSummary } from "./ChannelsView";

const C = {
  open: "text-[#047857] dark:text-[#059669]", openFill: "fill-[#047857] dark:fill-[#059669]", openStroke: "stroke-[#047857] dark:stroke-[#059669]", openBg: "bg-[#047857] dark:bg-[#059669]",
  done: "text-[#2563eb] dark:text-[#3b82f6]", doneFill: "fill-[#2563eb] dark:fill-[#3b82f6]", doneStroke: "stroke-[#2563eb] dark:stroke-[#3b82f6]", doneBg: "bg-[#2563eb] dark:bg-[#3b82f6]",
  late: "text-[#dc2626] dark:text-[#ef4444]", lateStroke: "stroke-[#dc2626] dark:stroke-[#ef4444]", lateBg: "bg-[#dc2626] dark:bg-[#ef4444]",
};
const HEALTH: Record<CeoHealth, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "On track", bg: "bg-[#047857] dark:bg-[#059669]", text: "text-[#047857] dark:text-[#34d399]", icon: CheckCircle2 },
  attention: { label: "Watch", bg: "bg-[#d97706]", text: "text-[#b45309] dark:text-[#fbbf24]", icon: CircleDot },
  critical: { label: "Off track", bg: "bg-[#dc2626] dark:bg-[#ef4444]", text: "text-[#dc2626] dark:text-[#f87171]", icon: AlertTriangle },
};
const fade: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const short = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** a number that counts up the first time it scrolls into view */
function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!inView || reduced) { setN(value); return; }
    const c = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, value, reduced]);
  return <span ref={ref} className="tabular-nums">{n.toLocaleString()}{suffix}</span>;
}

function Card({ title, sub, action, children, className }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.section variants={fade} aria-label={title} className={cn("flex min-w-0 flex-col rounded-[24px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]", className)}>
      <header className="mb-4 flex items-start gap-3">
        <span className="min-w-0 flex-1"><h2 className="text-[15.5px] font-semibold tracking-tight">{title}</h2>{sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}</span>
        {action}
      </header>
      {children}
    </motion.section>
  );
}

/** 30-day open vs overdue lines + done, with a crosshair tooltip */
function TrendChart({ days }: { days: { day: string; open: number; overdue: number; done: number }[] }) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, P = { l: 34, r: 12, t: 12, b: 26 };
  const max = Math.max(4, ...days.map((d) => Math.max(d.open, d.overdue)));
  const nice = Math.ceil(max / 4) * 4;
  const x = (i: number) => P.l + (i / Math.max(1, days.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / nice) * (H - P.t - P.b);
  const path = (k: "open" | "overdue") => days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const area = `${path("open")} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const h = hover != null ? days[hover] : null;
  if (!days.length) return <p className="py-16 text-center text-[13px] text-muted-foreground">No history yet. It fills in day by day.</p>;
  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className={cn("h-0.5 w-4 rounded-full", C.openBg)} /> Open</span>
        <span className="flex items-center gap-1.5"><span className={cn("h-0.5 w-4 rounded-full", C.lateBg)} /> Overdue</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" role="img" aria-label="Open and overdue tasks, last 30 days"
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(days.length - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (days.length - 1))))); }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ceoOpenArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#047857" stopOpacity="0.18" /><stop offset="100%" stopColor="#047857" stopOpacity="0" /></linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(nice * f)} y2={y(nice * f)} className="stroke-border" strokeWidth="1" strokeDasharray={f ? "3 4" : undefined} />
            <text x={P.l - 8} y={y(nice * f) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{Math.round(nice * f)}</text>
          </g>
        ))}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[10px]">{short(days[i]!.day)}</text>)}
        <motion.path d={area} fill="url(#ceoOpenArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} />
        <motion.path d={path("open")} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={C.openStroke} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
        <motion.path d={path("overdue")} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={C.lateStroke} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeInOut", delay: 0.15 }} />
        {/* end labels */}
        <circle cx={x(days.length - 1)} cy={y(days.at(-1)!.open)} r="4" className={cn(C.openFill, "stroke-card")} strokeWidth="2" />
        <circle cx={x(days.length - 1)} cy={y(days.at(-1)!.overdue)} r="4" className="fill-[#dc2626] stroke-card dark:fill-[#ef4444]" strokeWidth="2" />
        {h && hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} className="stroke-muted-foreground/40" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(h.open)} r="4.5" className={cn(C.openFill, "stroke-card")} strokeWidth="2" />
            <circle cx={x(hover)} cy={y(h.overdue)} r="4.5" className="fill-[#dc2626] stroke-card dark:fill-[#ef4444]" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover != null && (
        <div className="pointer-events-none absolute top-8 z-10 min-w-[150px] rounded-xl border border-border bg-popover px-3 py-2 text-[12px] shadow-lg" style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 75px), calc(100% - 150px))` }}>
          <p className="font-semibold">{new Date(h.day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
          <p className="mt-1 flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", C.openBg)} /> Open <b className="ml-auto tabular-nums">{h.open}</b></p>
          <p className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", C.lateBg)} /> Overdue <b className="ml-auto tabular-nums">{h.overdue}</b></p>
          <p className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", C.doneBg)} /> Done that day <b className="ml-auto tabular-nums">{h.done}</b></p>
        </div>
      )}
    </div>
  );
}

/** finished per week: one series, bars with rounded tops, value on hover */
function WeekBars({ weeks }: { weeks: { start: string; created: number; completed: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.completed));
  if (!weeks.length) return <p className="py-10 text-center text-[13px] text-muted-foreground">No weeks yet.</p>;
  return (
    <div>
      <div className="flex h-[150px] items-end gap-2">
        {weeks.map((w, i) => (
          <div key={w.start} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && <span className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-popover px-2 py-1 text-[11.5px] shadow">{w.completed} done · {w.created} new</span>}
            <motion.div initial={{ height: 0 }} animate={{ height: `${(w.completed / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className={cn("min-h-[2px] w-full rounded-t-[4px] transition-opacity", C.doneBg, hover != null && hover !== i && "opacity-45")} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-center text-[10.5px] text-muted-foreground">{weeks.map((w, i) => <span key={w.start} className="flex-1 truncate">{i === weeks.length - 1 ? "This wk" : short(w.start)}</span>)}</div>
    </div>
  );
}

export function CeoDashboard({ data, source, company, onFocus, onOpen, onView, onAssigned }: { data: CeoOverview; source: CeoSource; company: string | null; onFocus: (c: CeoCompany) => void; onOpen: (c: CeoCompany) => void; onView: (v: "tasks" | "team" | "portfolio") => void; onAssigned?: () => void }) {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const showTask = useTaskPopup((s) => s.show);
  const { data: trends } = useQuery({ queryKey: ["ceo-tower", "trends", source, company], queryFn: () => ceoApi.trends(source, company), staleTime: 60_000 });
  const days = (trends?.days ?? []).slice(-30);
  const weeks = (trends?.weeks ?? []).slice(-8);
  const k = data.kpis;
  // change vs a week ago (from the daily snapshots)
  const weekAgo = days.length > 7 ? days[days.length - 8] : undefined;
  const delta = (now: number, then?: number) => (then == null ? null : now - then);
  const dOpen = delta(k.open, weekAgo?.open), dLate = delta(k.overdue, weekAgo?.overdue);
  const doneThisWeek = weeks.at(-1)?.completed ?? k.doneWeek, doneLastWeek = weeks.at(-2)?.completed;
  const dDone = delta(doneThisWeek, doneLastWeek);
  const health = useMemo(() => {
    const n = { healthy: 0, attention: 0, critical: 0 } as Record<CeoHealth, number>;
    for (const c of data.companies) n[c.health]++;
    return n;
  }, [data.companies]);
  const total = data.companies.length || 1;
  const companies = [...data.companies].sort((a, b) => b.stats.overdue - a.stats.overdue || a.stats.progress - b.stats.progress).slice(0, 8);
  const people = [...data.people].filter((p) => p.stats.open > 0).sort((a, b) => b.stats.open - a.stats.open).slice(0, 7);
  const maxPeople = Math.max(1, ...people.map((p) => p.stats.open));
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const Delta = ({ v, goodWhenUp }: { v: number | null; goodWhenUp: boolean }) => {
    if (v == null || v === 0) return <span className="text-[11.5px] text-muted-foreground">{v === 0 ? "no change vs last week" : "—"}</span>;
    const good = goodWhenUp ? v > 0 : v < 0;
    const Icon = v > 0 ? TrendingUp : TrendingDown;
    return <span className={cn("inline-flex items-center gap-1 text-[11.5px] font-semibold", good ? "text-[#047857] dark:text-[#34d399]" : "text-[#dc2626] dark:text-[#f87171]")}><Icon className="h-3.5 w-3.5" />{v > 0 ? "+" : ""}{v} vs last week</span>;
  };

  const kpis = [
    { label: "Open tasks", value: k.open, sub: `${k.total} in total`, icon: CircleDot, tone: "#047857", delta: <Delta v={dOpen} goodWhenUp={false} />, go: () => onView("tasks") },
    { label: "Overdue", value: k.overdue, sub: "past their due date", icon: AlertTriangle, tone: "#dc2626", delta: <Delta v={dLate} goodWhenUp={false} />, go: () => onView("tasks") },
    { label: "Done this week", value: doneThisWeek, sub: `${k.done} done in all`, icon: CheckCircle2, tone: "#2563eb", delta: <Delta v={dDone} goodWhenUp />, go: () => onView("tasks") },
    { label: "Progress", value: k.progress, suffix: "%", sub: `${k.inProgress} being worked on`, icon: Clock3, tone: "#b45309", delta: <span className="text-[11.5px] text-muted-foreground">{k.unassigned} open with nobody on it</span>, go: () => onView("portfolio") },
  ];

  return (
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      {/* hero */}
      <motion.section variants={fade} aria-label="Today" className="relative overflow-hidden rounded-[28px] bg-forest p-6 text-white shadow-[0_28px_70px_-34px_rgba(11,42,31,0.95)] sm:p-7 dark:bg-[#0d2a20]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-brass/30 blur-3xl" animate={reduced ? undefined : { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[#34d399]/20 blur-3xl" animate={reduced ? undefined : { x: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-[12.5px] font-medium text-white/60">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {k.companies} {k.companies === 1 ? "company" : "companies"} · {k.people} people</p>
            <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-tight sm:text-[34px]">{hello}, <span className="text-brass-soft">{user?.firstName ?? "there"}</span></h1>
            <p className="mt-2 max-w-xl text-[14px] text-white/75">
              {k.overdue ? <>{k.overdue} tasks are late across <b className="text-white">{health.critical + health.attention}</b> {health.critical + health.attention === 1 ? "company" : "companies"} that need a look. </> : "Nothing is late right now. "}
              {doneThisWeek} finished this week.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => onView("tasks")} className="flex h-10 items-center gap-1.5 rounded-xl bg-brass px-4 text-[13.5px] font-semibold text-forest transition hover:brightness-110">See late tasks <ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => onView("team")} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-[13.5px] font-semibold ring-1 ring-white/20 transition hover:bg-white/15"><Users className="h-4 w-4" /> Team</button>
            </div>
          </div>
          {/* portfolio health: one segmented bar, labels + icons (status colours never alone) */}
          <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">Company health</p>
            <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full">
              {(["healthy", "attention", "critical"] as const).map((h, i) => health[h] > 0 && (
                <motion.span key={h} className={cn("h-full first:rounded-l-full last:rounded-r-full", HEALTH[h].bg)} initial={{ width: 0 }} animate={{ width: `${(health[h] / total) * 100}%` }} transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease: [0.22, 1, 0.36, 1] }} title={`${HEALTH[h].label}: ${health[h]}`} />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {(["healthy", "attention", "critical"] as const).map((h) => { const H = HEALTH[h]; return (
                <li key={h} className="rounded-xl bg-white/[0.06] px-2.5 py-2">
                  <p className="flex items-center gap-1 text-[11px] text-white/70"><H.icon className="h-3.5 w-3.5" /> {H.label}</p>
                  <p className="mt-0.5 text-[22px] font-semibold leading-none"><CountUp value={health[h]} /></p>
                </li>
              ); })}
            </ul>
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <motion.div variants={stagger} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Key numbers">
        {kpis.map((x) => (
          <motion.button key={x.label} type="button" role="listitem" variants={fade} whileHover={reduced ? undefined : { y: -3 }} onClick={x.go}
            className="group flex items-start gap-3 rounded-[22px] border border-white/70 bg-white/70 p-4 text-left shadow-[0_12px_32px_-24px_rgba(11,42,31,0.45)] backdrop-blur-xl transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(11,42,31,0.5)] dark:border-white/10 dark:bg-white/[0.04]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${x.tone}16`, color: x.tone }}><x.icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-muted-foreground">{x.label}</span>
              <span className={cn("mt-0.5 block text-[28px] font-bold leading-none tracking-tight", x.label === "Overdue" && x.value > 0 && C.late)}><CountUp value={x.value} suffix={x.suffix} /></span>
              <span className="mt-1.5 block">{x.delta}</span>
              <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{x.sub}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </motion.button>
        ))}
      </motion.div>

      {/* tasks the CEO gave out, and how many got done */}
      <motion.div variants={fade}><AssignedSummary onOpen={onAssigned} /></motion.div>

      <motion.div variants={stagger} className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Open vs overdue" sub="Last 30 days, all your companies"><TrendChart days={days} /></Card>
        <Card title="Finished per week" sub="Tasks completed, last 8 weeks"><WeekBars weeks={weeks} /></Card>
      </motion.div>

      <motion.div variants={stagger} className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Companies" sub="Most late first · click to focus the tower on one" action={<button type="button" onClick={() => onView("portfolio")} className="text-[12.5px] font-semibold text-primary hover:underline">All companies</button>}>
          <ul className="divide-y divide-border/70">
            {companies.map((c, i) => { const H = HEALTH[c.health]; return (
              <motion.li key={c.key} initial={reduced ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.05 }}>
                <div className="flex items-center gap-3 py-2.5">
                  <button type="button" onClick={() => onFocus(c)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2"><span className="truncate text-[13.5px] font-semibold hover:text-primary">{c.name}</span><span className="rounded px-1.5 py-px text-[10px] font-bold uppercase text-muted-foreground ring-1 ring-border">{c.source}</span></span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><motion.span className={cn("block h-full rounded-full", C.openBg)} initial={{ width: 0 }} animate={{ width: `${c.stats.progress}%` }} transition={{ duration: 0.9, delay: 0.3 + i * 0.05 }} /></span>
                      <span className="w-9 text-right text-[11.5px] tabular-nums text-muted-foreground">{c.stats.progress}%</span>
                    </span>
                  </button>
                  <span className="w-16 text-right text-[12px]"><b className="tabular-nums">{c.stats.open}</b> <span className="text-muted-foreground">open</span></span>
                  <span className={cn("w-[74px] text-right text-[12px] font-semibold", c.stats.overdue ? C.late : "text-muted-foreground")}>{c.stats.overdue} late</span>
                  <span className={cn("hidden w-[86px] items-center justify-end gap-1 text-[11.5px] font-semibold sm:flex", H.text)}><H.icon className="h-3.5 w-3.5" /> {H.label}</span>
                  <button type="button" aria-label={`Open ${c.name}`} onClick={() => onOpen(c)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowRight className="h-4 w-4" /></button>
                </div>
              </motion.li>
            ); })}
            {!companies.length && <li className="py-8 text-center text-[13px] text-muted-foreground">No companies yet.</li>}
          </ul>
        </Card>
        <Card title="Who has the most open work" sub="Open tasks per person · late part in red">
          <div className="mb-3 flex gap-4 text-[12px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-[3px]", C.openBg)} /> On time</span><span className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-[3px]", C.lateBg)} /> Late</span></div>
          <ul className="space-y-3">
            {people.map((p, i) => { const late = Math.min(p.stats.overdue, p.stats.open); const ok = p.stats.open - late; return (
              <li key={p.user.id} title={`${p.user.firstName} ${p.user.lastName}: ${p.stats.open} open, ${late} late`}>
                <div className="flex items-baseline gap-2 text-[12.5px]"><span className="min-w-0 flex-1 truncate font-medium">{p.user.firstName} {p.user.lastName}</span><span className="tabular-nums text-muted-foreground">{p.stats.open}{late ? <span className={cn("font-semibold", C.late)}> · {late} late</span> : null}</span></div>
                <div className="mt-1 flex h-2.5 gap-[2px]">
                  {ok > 0 && <motion.span className={cn("h-full rounded-l-[4px]", C.openBg, !late && "rounded-r-[4px]")} initial={{ width: 0 }} animate={{ width: `${(ok / maxPeople) * 100}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }} />}
                  {late > 0 && <motion.span className={cn("h-full rounded-r-[4px]", C.lateBg, !ok && "rounded-l-[4px]")} initial={{ width: 0 }} animate={{ width: `${(late / maxPeople) * 100}%` }} transition={{ duration: 0.8, delay: 0.4 + i * 0.05 }} />}
                </div>
              </li>
            ); })}
            {!people.length && <li className="py-8 text-center text-[13px] text-muted-foreground">Nobody has open work.</li>}
          </ul>
        </Card>
      </motion.div>

      <motion.div variants={stagger} className="grid gap-4 lg:grid-cols-2">
        <Card title="Needs your attention" sub="Most overdue tasks" action={<AlertTriangle className={cn("h-4 w-4", C.late)} />}>
          <ul className="space-y-1">
            {data.attention.overdue.slice(0, 6).map((o) => (
              <li key={`${o.source}-${o.task.id}`}>
                <button type="button" onClick={() => showTask(o.source, o.task.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-muted/60">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", C.lateBg)} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{o.task.name}</span><span className="block truncate text-[11.5px] text-muted-foreground">{o.company} · {o.people.join(", ") || "nobody on it"}</span></span>
                  <span className={cn("shrink-0 text-[12px] font-semibold", C.late)}>{short(o.due)}</span>
                </button>
              </li>
            ))}
            {!data.attention.overdue.length && <li className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> Nothing overdue.</li>}
          </ul>
        </Card>
        <Card title="Recently finished" sub="Last 7 days" action={<CheckCircle2 className={cn("h-4 w-4", C.done)} />}>
          <ul className="space-y-1">
            {data.updates.slice(0, 6).map((u) => (
              <li key={`${u.source}-${u.task.id}`}>
                <button type="button" onClick={() => showTask(u.source, u.task.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-muted/60">
                  <CheckCircle2 className={cn("h-4 w-4 shrink-0", C.done)} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{u.task.name}</span><span className="block truncate text-[11.5px] text-muted-foreground">{u.people.join(", ") || "Someone"} · {u.company ?? u.where}</span></span>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">{short(u.at)}</span>
                </button>
              </li>
            ))}
            {!data.updates.length && <li className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Building2 className="h-4 w-4" /> Nothing finished this week yet.</li>}
          </ul>
        </Card>
      </motion.div>
    </motion.div>
  );
}
