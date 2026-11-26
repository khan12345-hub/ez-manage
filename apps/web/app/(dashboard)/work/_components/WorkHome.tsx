"use client";

/* Work → Home: a personal dashboard (hero, numbers, up next, calendar, spaces, activity). */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, ArrowRight, CalendarCheck2, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Inbox, ListTodo, Plus, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { dayOf, workApi, workKeys, type MyWorkTask } from "@/services/work.api";
import { getMyMeetings } from "@/services/ceo-assistant.api";
import { useWorkCreate } from "@/store/work-create";
import { DueLabel, PriorityFlag, StatusGlyph } from "./primitives";

const DAY = 86_400_000;
/** a soft, stable colour per name (avatars) */
export function tintOf(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 42%)`;
}
function Initials({ name, size = 30 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: tintOf(name) }}>{ini}</span>;
}
const ago = (iso: string) => {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col rounded-[22px] bg-card p-5 shadow-[0_1px_2px_rgba(11,42,31,0.05),0_12px_32px_-24px_rgba(11,42,31,0.25)] ring-1 ring-black/[0.04] dark:ring-white/10", className)}>
      <header className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-semibold tracking-tight">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Ring({ value, size = 112 }: { value: number; size?: number }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${value}% done`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#d9bd8c" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="49" textAnchor="middle" fill="white" fontSize="22" fontWeight="700">{value}%</text>
      <text x="50" y="65" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9">done</text>
    </svg>
  );
}

function MiniCalendar({ tasks, onOpen }: { tasks: MyWorkTask[]; onOpen: (uid: string) => void }) {
  const [base, setBase] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [pick, setPick] = useState<number | null>(null);
  const today = dayOf(new Date().toISOString()).getTime();
  const byDay = useMemo(() => {
    const m = new Map<number, MyWorkTask[]>();
    for (const t of tasks) if (t.dueDate && !t.completedAt) { const k = dayOf(t.dueDate).getTime(); m.set(k, [...(m.get(k) ?? []), t]); }
    return m;
  }, [tasks]);
  const start = new Date(base); start.setDate(1 - ((base.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const picked = pick ? byDay.get(pick) ?? [] : [];
  return (
    <div>
      <div className="mb-2 flex items-center">
        <span className="flex-1 text-[13.5px] font-semibold">{base.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <button type="button" aria-label="Previous month" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() - 1, 1))} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Next month" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() + 1, 1))} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {days.map((d) => {
          const k = d.getTime();
          const due = byDay.get(k) ?? [];
          const late = due.length > 0 && k < today;
          return (
            <button key={k} type="button" onClick={() => setPick(pick === k ? null : k)} aria-label={`${d.toDateString()}${due.length ? `, ${due.length} due` : ""}`}
              className={cn("relative mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-full text-[12.5px] transition", d.getMonth() !== base.getMonth() && "text-muted-foreground/45", k === today && "bg-forest font-semibold text-white dark:bg-primary", pick === k && k !== today && "ring-2 ring-primary/40", k !== today && "hover:bg-muted")}>
              {d.getDate()}
              {due.length > 0 && <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", late ? "bg-destructive" : k === today ? "bg-brass-soft" : "bg-primary")} />}
            </button>
          );
        })}
      </div>
      {pick && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {!picked.length && <li className="text-[12.5px] text-muted-foreground">Nothing due that day.</li>}
          {picked.map((t) => <li key={t.id}><button type="button" onClick={() => onOpen(t.uid)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[13px] hover:bg-muted"><StatusGlyph status={t.status} size={13} /><span className="truncate">{t.name}</span></button></li>)}
        </ul>
      )}
    </div>
  );
}

export function WorkHome({ ws, onOpenTask, canCreate = true }: { ws: string; onOpenTask: (uid: string) => void; canCreate?: boolean }) {
  const { user } = useAuth();
  const openCreate = useWorkCreate((s) => s.openCreate);
  const { data: tasks = [], isLoading } = useQuery({ queryKey: workKeys.my(ws), queryFn: () => workApi.myTasks(ws) });
  const { data: inbox } = useQuery({ queryKey: ["work-inbox", "active"], queryFn: () => workApi.workInbox("active"), staleTime: 20_000 });
  const { data: allMeetings = [] } = useQuery({ queryKey: ["work-home", "my-meetings"], queryFn: getMyMeetings, staleTime: 60_000 });
  const meetings = useMemo(() => allMeetings.filter((m) => !m.cancelledAt && new Date(m.scheduledAt).getTime() > Date.now() - 60 * 60_000).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)).slice(0, 5), [allMeetings]);

  const s = useMemo(() => {
    const t0 = dayOf(new Date().toISOString()).getTime();
    const top = tasks.filter((t) => !t.parentId);
    const open = top.filter((t) => !t.completedAt);
    const overdue = open.filter((t) => t.dueDate && dayOf(t.dueDate).getTime() < t0);
    const today = open.filter((t) => t.dueDate && dayOf(t.dueDate).getTime() === t0);
    const doneWeek = top.filter((t) => t.completedAt && +new Date(t.completedAt) >= Date.now() - 7 * DAY);
    const upNext = [...open].sort((a, b) => (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity)).slice(0, 7);
    const spaces = new Map<string, { name: string; color: string; open: number; done: number }>();
    for (const t of top) {
      const k = t.list.space.name;
      const e = spaces.get(k) ?? { name: k, color: t.list.space.color, open: 0, done: 0 };
      t.completedAt ? e.done++ : e.open++;
      spaces.set(k, e);
    }
    const all = top.length;
    return { open, overdue, today, doneWeek, upNext, spaces: [...spaces.values()].sort((a, b) => b.open + b.done - (a.open + a.done)), pct: all ? Math.round((100 * (all - open.length)) / all) : 0 };
  }, [tasks]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const activity = (inbox?.items ?? []).slice(0, 6);
  const stats = [
    { label: "Open tasks", value: s.open.length, icon: ListTodo, tone: "#047857", bg: "#04785714" },
    { label: "Due today", value: s.today.length, icon: CalendarCheck2, tone: "#b45309", bg: "#b4530914" },
    { label: "Overdue", value: s.overdue.length, icon: AlarmClock, tone: "#dc2626", bg: "#dc262612" },
    { label: "Done this week", value: s.doneWeek.length, icon: CheckCircle2, tone: "#2563eb", bg: "#2563eb12" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 sm:px-6">
      {/* hero */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section aria-label="Today" className="relative overflow-hidden rounded-[26px] bg-forest p-5 text-white sm:p-6 shadow-[0_24px_60px_-30px_rgba(11,42,31,0.9)] lg:col-span-2 dark:bg-[#0d2a20]">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brass/25 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-white/60">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight sm:text-[30px]">{greeting}, <span className="text-brass-soft">{user?.firstName ?? "there"}</span></h1>
              <p className="mt-2 max-w-md text-[14px] text-white/75">
                {isLoading ? "Loading your day…" : s.today.length || s.overdue.length ? <>You have <b className="text-white">{s.today.length} due today</b>{s.overdue.length > 0 && <> and <b className="text-[#fca5a5]">{s.overdue.length} overdue</b></>}.</> : "Nothing urgent today. Nice work."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                {canCreate && <button type="button" onClick={() => openCreate(null)} className="flex h-10 items-center gap-1.5 rounded-xl bg-brass px-4 text-[13.5px] font-semibold text-forest transition hover:brightness-110"><Plus className="h-4 w-4" strokeWidth={2.5} /> New task</button>}
                <Link href={`/work/${ws}/inbox`} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-[13.5px] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"><Inbox className="h-4 w-4" /> Open inbox</Link>
                <Link href={`/work/${ws}?view=mine`} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-white/80 hover:text-white">All my tasks <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <div className="hidden sm:block"><Ring value={s.pct} /></div>
          </div>
        </section>
        <Card title="Due today" action={<span className="rounded-full bg-[#b45309]/10 px-2 py-0.5 text-[12px] font-semibold text-[#b45309]">{s.today.length}</span>}>
          {s.today.length ? (
            <ul className="space-y-1.5">
              {s.today.slice(0, 5).map((t) => (
                <li key={t.id}><button type="button" onClick={() => onOpenTask(t.uid)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted"><StatusGlyph status={t.status} size={15} /><span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{t.name}</span><span className="block truncate text-[11.5px] text-muted-foreground">{t.list.space.name} / {t.list.name}</span></span><PriorityFlag priority={t.priority} /></button></li>
              ))}
            </ul>
          ) : <div className="flex flex-1 flex-col items-center justify-center py-6 text-center"><CircleDot className="h-8 w-8 text-primary/40" /><p className="mt-2 text-[13px] text-muted-foreground">Nothing due today.</p></div>}
        </Card>
      </div>

      {/* numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((x) => (
          <div key={x.label} className="flex items-center gap-4 rounded-[20px] bg-card p-4 shadow-[0_1px_2px_rgba(11,42,31,0.05)] ring-1 ring-black/[0.04] dark:ring-white/10">
            <span className="ez-tint flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ "--c": x.tone } as React.CSSProperties}><x.icon className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-[26px] font-bold leading-none tracking-tight tabular-nums" style={{ color: x.label === "Overdue" && x.value ? x.tone : undefined }}>{isLoading ? "–" : x.value}</span><span className="mt-1 block truncate text-[12.5px] text-muted-foreground">{x.label}</span></span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Up next" className="lg:col-span-2" action={<Link href={`/work/${ws}?view=mine`} className="flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>}>
          {isLoading ? <div className="h-48 animate-pulse rounded-xl bg-muted" /> : !s.upNext.length ? <p className="py-10 text-center text-[13px] text-muted-foreground">Nothing assigned to you. Tasks you&apos;re assigned to show up here.</p> : (
            <ul className="divide-y divide-border/70">
              {s.upNext.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpenTask(t.uid)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-muted/60">
                    <StatusGlyph status={t.status} size={16} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{t.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground"><span className="h-2 w-2 rounded-[3px]" style={{ background: t.list.space.color }} />{t.list.space.name} / {t.list.name}</span>
                    </span>
                    {t.status && <span className="hidden rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold sm:inline" style={{ background: `${t.status.color}1c`, color: t.status.color }}>{t.status.name}</span>}
                    <span className="flex -space-x-1.5">{t.assignees.slice(0, 3).map((a) => <span key={a.id} className="ring-2 ring-card rounded-full"><Initials name={`${a.firstName} ${a.lastName}`} size={24} /></span>)}</span>
                    <DueLabel task={t} className="w-[70px] text-right text-[12.5px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Calendar"><MiniCalendar tasks={tasks} onOpen={onOpenTask} /></Card>
      </div>

      <Card title="Upcoming meetings" action={<span className="flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> {meetings.length}</span>}>
        {!meetings.length ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">No meetings scheduled. Meetings you create or are invited to show up here.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {meetings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="w-24 shrink-0 rounded-xl border border-border bg-muted/30 px-2 py-1.5 text-center">
                  <p className="text-[10.5px] font-medium uppercase text-muted-foreground">{new Date(m.scheduledAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p>
                  <p className="text-[16px] font-semibold leading-tight">{new Date(m.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{m.title}</p>
                  <p className="text-[12px] text-muted-foreground">{m.attendees?.length ?? 0} invited</p>
                </div>
                {m.meetingLink && <a href={m.meetingLink} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 rounded-lg bg-forest px-3 py-1.5 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"><Video className="h-3.5 w-3.5" /> Join</a>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Progress by space" className="lg:col-span-1">
          {!s.spaces.length ? <p className="py-6 text-center text-[13px] text-muted-foreground">No tasks yet.</p> : (
            <ul className="space-y-3.5">
              {s.spaces.slice(0, 6).map((sp) => {
                const total = sp.open + sp.done;
                const pct = total ? Math.round((100 * sp.done) / total) : 0;
                return (
                  <li key={sp.name}>
                    <div className="flex items-center gap-2 text-[13px]"><span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: sp.color }} /><span className="min-w-0 flex-1 truncate font-medium">{sp.name}</span><span className="text-[12px] text-muted-foreground">{sp.done}/{total}</span></div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: sp.color }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" className="lg:col-span-2" action={<Link href={`/work/${ws}/inbox`} className="flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">Inbox <ArrowRight className="h-3.5 w-3.5" /></Link>}>
          {!activity.length ? <p className="py-8 text-center text-[13px] text-muted-foreground">You&apos;re all caught up.</p> : (
            <ul className="space-y-1">
              {activity.map((n: any) => {
                const who: string = n.metadata?.actorName ?? n.title ?? "Someone";
                const uid: string | undefined = n.metadata?.taskUid;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => uid && onOpenTask(uid)} className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/60">
                      <Initials name={who} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2"><span className="truncate text-[13.5px] font-semibold">{who}</span><span className="shrink-0 text-[11.5px] text-muted-foreground">{ago(n.createdAt)}</span>{!n.isRead && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">{n.message || n.title}{n.task?.name ? <> · <span className="font-medium text-foreground">{n.task.name}</span></> : null}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
