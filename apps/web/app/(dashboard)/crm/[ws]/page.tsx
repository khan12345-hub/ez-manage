"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Gauge, Target, TrendingUp, Trophy, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { contactName, crmApi, crmKeys, fmtMoney, userName, type CrmActivity } from "@/services/crm.api";
import { fmtDate, glass, isPast, onErr, useCrmWs } from "../_lib/crm";
import { Avatar, Empty, Skeleton } from "../_components/bits";
import { ActivityLine } from "../_components/Timeline";

const fade: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

function Card({ title, sub, action, children, className }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.section variants={fade} aria-label={title} className={cn(glass, "flex min-w-0 flex-col p-5", className)}>
      <header className="mb-3 flex items-start gap-3"><span className="min-w-0 flex-1"><h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>{sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}</span>{action}</header>
      {children}
    </motion.section>
  );
}

export default function CrmHome() {
  const { uid, ws } = useCrmWs();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  const { data, isLoading } = useQuery({ queryKey: crmKeys.home(uid, pipelineId), queryFn: () => crmApi.home(uid, pipelineId), enabled: !!uid, refetchInterval: 60_000 });
  const done = useMutation({ mutationFn: (a: CrmActivity) => crmApi.updateActivity(uid, a.id, { done: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", uid] }), onError: onErr() });
  const [hover, setHover] = useState<number | null>(null);
  const cur = data?.currency ?? ws?.currency ?? "USD";
  const hour = new Date().getHours();

  if (isLoading || !data) return <div className="grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}<Skeleton className="h-72 lg:col-span-3" /><Skeleton className="h-72" /></div>;
  const k = data.kpis;
  const open = data.stages.filter((s) => !s.isWon && !s.isLost);
  const max = Math.max(1, ...open.map((s) => s.amount));
  const kpis = [
    { label: "Open pipeline", value: fmtMoney(k.pipelineValue, cur, true), sub: `${k.openDeals} open ${k.openDeals === 1 ? "deal" : "deals"}`, icon: CircleDollarSign, tone: "#047857" },
    { label: "Weighted forecast", value: fmtMoney(k.weighted, cur, true), sub: "value × each stage's chance", icon: Gauge, tone: "#2563eb" },
    { label: "Won this month", value: fmtMoney(k.wonMonth, cur, true), sub: `${k.wonMonthCount} ${k.wonMonthCount === 1 ? "deal" : "deals"} closed`, icon: Trophy, tone: "#b45309" },
    { label: "Win rate · 90 days", value: k.winRate === null ? "—" : `${k.winRate}%`, sub: k.winRate === null ? "no closed deals yet" : "won ÷ (won + lost)", icon: Target, tone: "#be185d" },
  ];

  return (
    <motion.div initial={reduced ? false : "hidden"} animate="show" variants={stagger} className="space-y-4">
      <motion.div variants={fade} className="flex flex-wrap items-end gap-3">
        <span className="min-w-0 flex-1">
          <p className="text-[12.5px] text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {k.contacts} contacts · {k.newContacts} new this week</p>
          <h2 className="text-[26px] font-semibold tracking-tight">{hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, {user?.firstName ?? "there"}</h2>
        </span>
        {k.myOverdue > 0 && <Link href={`/crm/${uid}/tasks?state=overdue`} className="flex items-center gap-1.5 rounded-full bg-[#dc2626]/10 px-3 py-1.5 text-[12.5px] font-semibold text-[#dc2626] dark:text-[#f87171]"><AlertTriangle className="h-3.5 w-3.5" /> {k.myOverdue} overdue {k.myOverdue === 1 ? "task" : "tasks"}</Link>}
      </motion.div>

      <motion.div variants={stagger} role="list" aria-label="Key numbers" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((x) => (
          <motion.div key={x.label} role="listitem" variants={fade} className={cn(glass, "flex items-start gap-3 p-4")}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${x.tone}16`, color: x.tone }}><x.icon className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-[12px] font-medium text-muted-foreground">{x.label}</span><span className="block text-[26px] font-bold leading-tight tracking-tight tabular-nums">{x.value}</span><span className="block truncate text-[11.5px] text-muted-foreground">{x.sub}</span></span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={stagger} className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Pipeline by stage" sub="Open deal value in each stage" action={data.pipelines.length > 1 ? <select aria-label="Pipeline" value={data.pipelineId ?? ""} onChange={(e) => setPipelineId(Number(e.target.value))} className="h-8 rounded-lg border border-border bg-background px-2 text-[12.5px]">{data.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <Link href={`/crm/${uid}/deals`} className="text-[12.5px] font-semibold text-primary hover:underline">Open board</Link>}>
          {!open.some((s) => s.count) ? <Empty icon={TrendingUp} title="No open deals yet" body="Create a deal and it shows up here by stage." /> : (
            <ul className="space-y-2.5" aria-label="Stages">
              {open.map((s, i) => (
                <li key={s.id} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)} className="relative">
                  <div className="flex items-baseline gap-2 text-[12.5px]"><span className="min-w-0 flex-1 truncate font-medium">{s.name} <span className="font-normal text-muted-foreground">· {s.probability}%</span></span><span className="tabular-nums text-muted-foreground">{s.count} {s.count === 1 ? "deal" : "deals"}</span><b className="w-20 text-right tabular-nums">{fmtMoney(s.amount, cur, true)}</b></div>
                  <div className="mt-1 h-3 overflow-hidden rounded-[4px] bg-black/[0.04] dark:bg-white/[0.06]">
                    <motion.div className={cn("h-full rounded-[4px] bg-[#047857] transition-opacity dark:bg-[#059669]", hover !== null && hover !== s.id && "opacity-45")} initial={{ width: 0 }} animate={{ width: `${(s.amount / max) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                  {hover === s.id && <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-lg border border-border bg-popover px-2 py-1 text-[11.5px] shadow">{fmtMoney(s.amount, cur)} · weighted {fmtMoney(s.weighted, cur)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="My tasks" sub="Due today or late" action={<Link href={`/crm/${uid}/tasks`} className="text-[12.5px] font-semibold text-primary hover:underline">All tasks</Link>}>
          {!data.myTasks.length ? <Empty icon={CheckCircle2} title="You're all caught up" body="Tasks due today or late show here." /> : (
            <ul className="space-y-1">
              {data.myTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 rounded-xl px-1.5 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                  <button type="button" aria-label={`Mark “${t.subject}” done`} onClick={() => done.mutate(t)} className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40 transition hover:border-primary" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{t.subject}</span><span className="block truncate text-[11.5px] text-muted-foreground">{t.contact ? contactName(t.contact) : t.deal?.name ?? t.company?.name ?? "No record"}</span></span>
                  <span className={cn("shrink-0 text-[11.5px] font-semibold", isPast(t.dueAt) ? "text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{isPast(t.dueAt) ? fmtDate(t.dueAt) : "Today"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </motion.div>

      <motion.div variants={stagger} className="grid gap-4 lg:grid-cols-3">
        <Card title="Closing soon" sub="Open deals, next 30 days">
          {!data.closing.length ? <Empty icon={CalendarClock} title="Nothing closing soon" /> : (
            <ul className="space-y-1">
              {data.closing.map((d) => (
                <li key={d.id}><Link href={`/crm/${uid}/deals/${d.id}`} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{d.name}</span><span className="block truncate text-[11.5px] text-muted-foreground">{d.company?.name ?? "No company"} · {d.stage.name}</span></span>
                  <span className="shrink-0 text-right"><b className="block text-[12.5px] tabular-nums">{fmtMoney(d.amount, cur, true)}</b><span className={cn("block text-[11px]", isPast(d.closeDate) ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{fmtDate(d.closeDate)}</span></span>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Leaderboard" sub="Won this month · open pipeline">
          {!data.leaderboard.length ? <Empty icon={Trophy} title="No owners yet" /> : (
            <ol className="space-y-2">
              {data.leaderboard.map((r, i) => (
                <li key={r.user?.id ?? i} className="flex items-center gap-2.5">
                  <span className={cn("w-5 text-center text-[12px] font-bold tabular-nums", i === 0 ? "text-[#b45309]" : "text-muted-foreground")}>{i + 1}</span>
                  <Avatar user={r.user} size={28} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{userName(r.user)}</span><span className="block text-[11.5px] text-muted-foreground">{fmtMoney(r.pipeline, cur, true)} open</span></span>
                  <span className="text-right"><b className="block text-[13px] tabular-nums">{fmtMoney(r.won, cur, true)}</b><span className="block text-[11px] text-muted-foreground">{r.wonCount} won</span></span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Recent activity" sub="Calls, notes, meetings and stage moves">
          {!data.recent.length ? <Empty icon={UserPlus} title="Nothing logged yet" body="Log a call or a note on a contact." /> : (
            <ul className="space-y-2.5">{data.recent.map((a) => <li key={a.id}><ActivityLine a={a} ws={uid} compact /></li>)}</ul>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
