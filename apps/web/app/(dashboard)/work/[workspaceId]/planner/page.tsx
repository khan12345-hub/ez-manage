"use client";

/* Work → Planner (ClickUp style): this week's tasks on their due days, an Overdue strip and an
 * Unscheduled panel; drag a card onto a day to schedule it, back to Unscheduled to clear it. */

import { Suspense, useMemo, useState } from "react";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayOf, workApi, workKeys, type MyWorkTask } from "@/services/work.api";
import { AvatarStack, PriorityFlag } from "../../_components/primitives";
import { TaskDrawer } from "../../_components/TaskDrawer";
import { CalendarGrid } from "../../_components/CalendarGrid";

const DAY = 86_400_000;
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
/** Monday of the week that holds `d` (local) */
function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** the new due date on `day`: keep the old time of day when there was one, else noon */
function dueOn(day: Date, old: string | null) {
  const t = new Date(day);
  if (old) { const o = new Date(old); t.setHours(o.getHours(), o.getMinutes(), 0, 0); } else t.setHours(12, 0, 0, 0);
  return t.toISOString();
}

function PlannerInner() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [who, setWho] = useState<"me" | "all">("me");
  const [mode, setMode] = useState<"week" | "month">("week");
  const [start, setStart] = useState(() => weekStart(new Date()));
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), staleTime: 30_000 });
  const canEdit = !!tree?.access.canEdit;
  const key = who === "me" ? workKeys.my(ws) : (["work", "all-tasks", ws] as const);
  const { data: raw = [], isLoading } = useQuery({ queryKey: key, queryFn: () => (who === "me" ? workApi.myTasks(ws) : workApi.allTasks(ws)) });
  const open = useMemo(() => raw.filter((t) => !t.completedAt), [raw]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), [start]);
  const today = new Date();
  const t0 = dayOf(today.toISOString()).getTime();
  const byDay = (d: Date) => open.filter((t) => t.dueDate && sameDay(new Date(t.dueDate), d));
  const overdue = open.filter((t) => t.dueDate && dayOf(t.dueDate).getTime() < t0);
  const unscheduled = open.filter((t) => !t.dueDate);

  const setTask = (uid: string | null) => {
    const next = new URLSearchParams(sp.toString());
    uid ? next.set("task", uid) : next.delete("task");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  const move = async (dueDate: string | null) => {
    const t = open.find((x) => x.id === dragId);
    setDragId(null); setOver(null);
    if (!t || !canEdit) return;
    if ((t.dueDate ?? null) === dueDate) return;
    const prev = qc.getQueryData<MyWorkTask[]>(key);
    qc.setQueryData<MyWorkTask[]>(key, (rows) => rows?.map((r) => (r.id === t.id ? { ...r, dueDate } : r)));
    try {
      await workApi.updateTask(t.id, { dueDate });
      toast.success(dueDate ? `“${t.name}” is due ${new Date(dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : `“${t.name}” is unscheduled`);
    } catch (e) {
      qc.setQueryData(key, prev);
      toast.error(errMsg(e, "Couldn't move it."));
    }
    void qc.invalidateQueries({ queryKey: workKeys.my(ws) });
    void qc.invalidateQueries({ queryKey: ["work", "all-tasks", ws] });
    void qc.invalidateQueries({ queryKey: ["work", "tasks"] });
  };
  const drop = (zone: string, due: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (dragId != null && canEdit) { e.preventDefault(); setOver(zone); } },
    onDragLeave: () => setOver((o) => (o === zone ? null : o)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); void move(due); },
  });

  const Card = ({ t }: { t: MyWorkTask }) => (
    <li>
      <button type="button" draggable={canEdit} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => setTask(t.uid)}
        className={cn("block w-full rounded-lg border border-border bg-card px-2.5 py-2 text-left shadow-[0_1px_2px_rgb(11_42_31/0.05)] transition hover:border-primary/30 hover:shadow-md", canEdit && "cursor-grab active:cursor-grabbing", dragId === t.id && "opacity-40")}
        style={{ borderLeftColor: t.status?.color ?? "#9CA3AF", borderLeftWidth: 3 }}>
        <span className="block text-[13px] font-medium leading-snug">{t.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ background: t.list.space.color }} />
          <span className="min-w-0 flex-1 truncate">{t.list.name}</span>
          {who === "all" && t.assignees.length > 0 && <AvatarStack users={t.assignees} size={16} max={2} />}
          {t.priority && <PriorityFlag priority={t.priority} />}
        </span>
      </button>
    </li>
  );

  const label = `${days[0]!.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[0]!.getMonth() === days[6]!.getMonth() ? days[6]!.getDate() : days[6]!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${days[6]!.getFullYear()}`;
  const shift = (n: number) => mode === "week" ? setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7)) : setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="flex min-h-full flex-col px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Planner</h1>
        <span className="text-[13px] text-muted-foreground">{mode === "week" ? label : month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={mode === "week" ? "Previous week" : "Previous month"} onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setStart(weekStart(new Date())); const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="h-8 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold hover:bg-muted">Today</button>
          <button type="button" aria-label={mode === "week" ? "Next week" : "Next month"} onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <span className="flex-1" />
        <div role="group" aria-label="Whose tasks" className="flex rounded-lg border border-border bg-card p-0.5 text-[12.5px]">
          {(["me", "all"] as const).map((w) => <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)} className={cn("rounded-md px-2.5 py-1 font-medium", who === w ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{w === "me" ? "Me" : "Everyone"}</button>)}
        </div>
        <div role="group" aria-label="Planner view" className="flex rounded-lg border border-border bg-card p-0.5 text-[12.5px]">
          <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 font-medium", mode === "week" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}><CalendarRange className="h-3.5 w-3.5" /> Week</button>
          <button type="button" aria-pressed={mode === "month"} onClick={() => setMode("month")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 font-medium", mode === "month" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}><CalendarDays className="h-3.5 w-3.5" /> Month</button>
        </div>
      </header>
      {canEdit && mode === "week" && <p className="mt-1 text-[12px] text-muted-foreground">Drag a task onto a day to schedule it, or onto Unscheduled to clear its date.</p>}

      {isLoading ? <div className="mt-4 h-96 animate-pulse rounded-2xl bg-muted" /> : mode === "month" ? (
        <div className="mt-4">
          <CalendarGrid month={month} onMonth={setMonth} onOpen={(uid) => setTask(uid)} items={open.map((t) => ({ id: t.id, uid: t.uid, name: t.name, dueDate: t.dueDate, completedAt: t.completedAt, color: t.status?.color }))} />
        </div>
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-3">
            {overdue.length > 0 && (
              <section aria-label="Overdue" className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-3">
                <h2 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.05em] text-destructive"><AlarmClock className="h-3.5 w-3.5" /> Overdue <span className="font-normal">{overdue.length}</span></h2>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{overdue.map((t) => <Card key={t.id} t={t} />)}</ul>
              </section>
            )}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
              {days.map((d) => {
                const k = d.toDateString();
                const items = byDay(d);
                const isToday = sameDay(d, today);
                const past = d.getTime() < t0;
                return (
                  <section key={k} aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} {...drop(k, null)}
                    onDrop={(e) => { e.preventDefault(); void move(dueOn(d, open.find((x) => x.id === dragId)?.dueDate ?? null)); }}
                    className={cn("flex min-h-[120px] flex-col rounded-xl border bg-card/70 transition-colors md:min-h-[420px]", over === k && dragId != null ? "border-primary/60 ring-2 ring-primary/15" : "border-border", isToday && "border-primary/40 bg-primary/[0.04]", past && !isToday && "opacity-80")}>
                    <header className="flex items-baseline gap-1.5 border-b border-border/70 px-2.5 py-2">
                      <span className={cn("text-[12px] font-semibold uppercase tracking-[0.05em]", isToday ? "text-primary" : "text-muted-foreground")}>{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                      <span className={cn("flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold", isToday && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{items.length || ""}</span>
                    </header>
                    <ul className="flex flex-1 flex-col gap-1.5 p-1.5">{items.map((t) => <Card key={t.id} t={t} />)}</ul>
                  </section>
                );
              })}
            </div>
          </div>
          <aside aria-label="Unscheduled" {...drop("none", null)} className={cn("h-fit rounded-xl border bg-card p-3 transition-colors lg:sticky lg:top-4", over === "none" && dragId != null ? "border-primary/60 ring-2 ring-primary/15" : "border-border")}>
            <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><Inbox className="h-4 w-4 text-muted-foreground" /> Unscheduled <span className="font-normal text-muted-foreground">{unscheduled.length}</span></h2>
            {unscheduled.length ? <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">{unscheduled.map((t) => <Card key={t.id} t={t} />)}</ul> : <p className="py-6 text-center text-[12.5px] text-muted-foreground">Every open task has a date.</p>}
          </aside>
        </div>
      )}
      <TaskDrawer taskUid={sp.get("task")} onClose={() => setTask(null)} onOpenTask={(uid) => setTask(uid)} />
    </div>
  );
}

export default function PlannerPage() {
  return <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}><PlannerInner /></Suspense>;
}
