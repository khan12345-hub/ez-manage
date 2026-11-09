"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock3, LayoutDashboard, Plus, RefreshCw, Timer, Users2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, userName, workApi, type StatsKind, type StatsTask, type WorkStats } from "@/services/work.api";
import { Bars, Donut, StackBar, colorAt, type Slice } from "./Charts";
import { AvatarStack, DueLabel, PriorityFlag, StatusGlyph } from "./primitives";
import { ActivityRow } from "./TaskDetailSections";

type Card = "counts" | "workload" | "totalByAssignee" | "openByAssignee" | "completedWeek" | "dueWeek" | "activity" | "time" | "statusPie";
type Template = { id: string; name: string; hint: string; icon: typeof BarChart3; color: string; cards: Card[] };

export const DASH_TEMPLATES: Template[] = [
  { id: "simple", name: "Simple Dashboard", hint: "Manage and prioritize tasks", icon: LayoutDashboard, color: "#2563EB", cards: ["counts", "workload", "totalByAssignee", "openByAssignee", "completedWeek", "dueWeek", "activity"] },
  { id: "team", name: "Team Reporting", hint: "Encourage collaboration by viewing progress across teams", icon: Users2, color: "#EA580C", cards: ["counts", "openByAssignee", "totalByAssignee", "completedWeek", "activity"] },
  { id: "time", name: "Time Tracking", hint: "View and report on time tracking metrics", icon: Timer, color: "#0D9488", cards: ["time", "counts", "dueWeek"] },
  { id: "project", name: "Project Management", hint: "Analyze project progress and metrics", icon: Briefcase, color: "#7C3AED", cards: ["counts", "statusPie", "workload", "dueWeek", "completedWeek", "activity"] },
];
const dashKey = (kind: StatsKind, uid: string) => `ez:work:dash:${kind}:${uid}`;

function ago(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  return `${Math.floor(s / 60)} min${s >= 120 ? "s" : ""} ago`;
}

/** The Dashboard view of a list, folder or space: pick a template, then live cards. */
export function LocationDashboard({ kind, uid, onOpenTask }: { kind: StatsKind; uid: string; onOpenTask: (uid: string) => void }) {
  const [tpl, setTpl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(true);
  const [, tick] = useState(0);
  useEffect(() => {
    try { setTpl(localStorage.getItem(dashKey(kind, uid))); } catch {}
    setReady(true);
  }, [kind, uid]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const choose = (id: string | null) => {
    setTpl(id);
    try { id ? localStorage.setItem(dashKey(kind, uid), id) : localStorage.removeItem(dashKey(kind, uid)); } catch {}
  };
  const template = DASH_TEMPLATES.find((t) => t.id === tpl);
  const { data, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["work", "stats", kind, uid],
    queryFn: () => workApi.stats(kind, uid),
    enabled: !!template,
    refetchInterval: auto ? 60_000 : false,
  });

  if (!ready) return null;
  if (!template) {
    return (
      <section aria-label="Choose a Dashboard template" className="mx-auto max-w-3xl py-12 text-center">
        <h2 className="text-[20px] font-semibold">Choose a Dashboard template</h2>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] text-muted-foreground">Get started with a Dashboard template. It shows live numbers for everything in this {kind}.</p>
        <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {DASH_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => choose(t.id)} className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-[0_8px_24px_-16px_rgb(11_42_31/0.35)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${t.color}1f`, color: t.color }}><t.icon className="h-4.5 w-4.5" /></span>
              <span className="mt-3 block text-[14.5px] font-semibold group-hover:text-primary">{t.name}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{t.hint}</span>
            </button>
          ))}
          <button type="button" disabled className="rounded-xl border border-dashed border-border bg-card p-4 opacity-60">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><Plus className="h-4 w-4" /></span>
            <span className="mt-3 block text-[14.5px] font-semibold">Start from scratch</span>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Soon</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <div aria-label={`${template.name}`} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold">{template.name}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => refetch()} className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} /> Refreshed: {dataUpdatedAt ? ago(Date.now() - dataUpdatedAt) : "…"}
        </button>
        <button type="button" aria-pressed={auto} onClick={() => setAuto(!auto)} className={cn("flex h-7 items-center gap-1.5 rounded-md border px-2", auto ? "border-primary/40 text-foreground" : "border-border text-muted-foreground")}>
          <Clock3 className="h-3.5 w-3.5" /> Auto refresh: {auto ? "On" : "Off"}
        </button>
        <button type="button" onClick={() => choose(null)} className="h-7 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground">Change template</button>
      </div>
      {!data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : (
        <Cards cards={template.cards} s={data} onOpenTask={onOpenTask} />
      )}
    </div>
  );
}

function Cards({ cards, s, onOpenTask }: { cards: Card[]; s: WorkStats; onOpenTask: (uid: string) => void }) {
  const statusSlices: Slice[] = s.byStatus.map((x) => ({ label: x.name, value: x.count, color: x.color }));
  const total: Slice[] = s.byAssignee.map((a, i) => ({ label: userName(a.user), value: a.total, color: colorAt(i) }));
  const open: Slice[] = s.byAssignee.filter((a) => a.open).map((a, i) => ({ label: a.user.firstName, value: a.open, color: colorAt(i) }));
  const time: Slice[] = s.timeByUser.map((t, i) => ({ label: t.user.firstName, value: t.seconds, color: colorAt(i) }));
  const members = s.byAssignee.map((a) => a.user);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      {cards.map((c) => {
        switch (c) {
          case "counts":
            return (
              <div key={c} className="grid grid-cols-3 gap-4 lg:col-span-6">
                <Count label="Unassigned" value={s.totals.unassigned} />
                <Count label="In Progress" value={s.totals.inProgress} />
                <Count label="Completed" value={s.totals.done} />
              </div>
            );
          case "workload":
            return <Panel key={c} title="Workload by Status" span={6}><StackBar data={statusSlices} /></Panel>;
          case "statusPie":
            return <Panel key={c} title="Tasks by Status" span={3}><Donut data={statusSlices} label="Tasks by status" /></Panel>;
          case "totalByAssignee":
            return <Panel key={c} title="Total Tasks by Assignee" span={3}><Donut data={total} label="Total tasks by assignee" /></Panel>;
          case "openByAssignee":
            return <Panel key={c} title="Open Tasks by Assignee" span={3}><Bars data={open} /></Panel>;
          case "time":
            return <Panel key={c} title="Time Tracked by Person" span={6}><Bars data={time} format={(n) => formatDuration(n)} unit="" /></Panel>;
          case "completedWeek":
            return <Panel key={c} title="Tasks Completed This Week" span={3}><TaskRows tasks={s.completedThisWeek} onOpen={onOpenTask} empty="No Results" /></Panel>;
          case "dueWeek":
            return <Panel key={c} title="Tasks Due This Week or Overdue" span={3}><TaskRows tasks={s.dueThisWeek} onOpen={onOpenTask} empty="Nothing due this week" /></Panel>;
          case "activity":
            return (
              <Panel key={c} title="Latest Activity" span={3}>
                {s.activity.length ? (
                  <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    {s.activity.map((a) => (
                      <li key={a.id} className="rounded-lg border border-border/70 p-2.5">
                        <button type="button" onClick={() => onOpenTask(a.task.uid)} className="mb-1 block w-full truncate text-left text-[13px] font-semibold hover:text-primary">{a.task.name}</button>
                        <ul><ActivityRow a={{ ...(a as any), taskId: 0 }} members={members} /></ul>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-10 text-center text-[13px] text-muted-foreground">No activity yet.</p>
                )}
              </Panel>
            );
        }
      })}
    </div>
  );
}

const SPAN: Record<number, string> = { 2: "lg:col-span-2", 3: "lg:col-span-3", 6: "lg:col-span-6" };
export function Panel({ title, span = 3, children, action }: { title: string; span?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn("min-w-0 rounded-xl border border-border bg-card p-4", SPAN[span])}>
      <header className="mb-3 flex items-center gap-2">
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        <span className="flex-1" />
        {action}
      </header>
      {children}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <section aria-label={label} className="rounded-xl border border-border bg-card p-4 text-center">
      <h3 className="text-left text-[13px] font-semibold">{label}</h3>
      <p className="mt-2 font-mono text-[34px] leading-none">{value}</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">tasks</p>
    </section>
  );
}

function TaskRows({ tasks, onOpen, empty }: { tasks: StatsTask[]; onOpen: (uid: string) => void; empty: string }) {
  if (!tasks.length) return <p className="py-10 text-center text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="max-h-80 divide-y divide-border/70 overflow-y-auto">
      {tasks.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => onOpen(t.uid)} className="flex w-full items-center gap-2.5 py-2 text-left hover:bg-accent/30">
            <StatusGlyph status={t.status as any} size={14} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{t.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{t.list.name}</span>
            </span>
            {t.assignees.length > 0 && <AvatarStack users={t.assignees} size={20} />}
            <PriorityFlag priority={t.priority} />
            {t.dueDate && !t.completedAt && <DueLabel task={t} className="text-[12px]" />}
            {t.completedAt && <span className="text-[11.5px] text-muted-foreground">{new Date(t.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
