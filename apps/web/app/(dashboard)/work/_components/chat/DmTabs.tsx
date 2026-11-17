"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CircleCheck, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { userName, workApi, type DmTask, type WorkUser } from "@/services/work.api";
import { Avatar } from "../primitives";
import { CalendarGrid, monthWindow } from "../CalendarGrid";
import { TaskTable } from "../TaskTable";
import { TaskDrawer } from "../TaskDrawer";

type Who = "all" | "them" | "me" | "shared";
const PRIORITY: Record<string, string> = { URGENT: "#c0392b", HIGH: "#b08d57", NORMAL: "#3b6fd8", LOW: "#8a8f98" };
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function WhoFilter({ who, setWho, others }: { who: Who; setWho: (w: Who) => void; others: WorkUser[] }) {
  const them = others.length === 1 ? userName(others[0]!).split(" ")[0] : "Them";
  const opts: [Who, string][] = [["all", "Everyone"], ["them", them!], ["me", "Me"], ["shared", "Shared"]];
  return (
    <div role="group" aria-label="Whose tasks" className="flex rounded-lg border border-border p-0.5">
      {opts.map(([v, l]) => <button key={v} type="button" aria-pressed={who === v} onClick={() => setWho(v)} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium", who === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
    </div>
  );
}

function TaskRow({ t, onOpen }: { t: DmTask; onOpen: (uid: string) => void }) {
  const overdue = t.dueDate && !t.completedAt && new Date(t.dueDate) < startOfDay(new Date());
  return (
    <li>
      <button type="button" onClick={() => onOpen(t.uid)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent/50">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.status?.color ?? "#8a8f98" }} title={t.status?.name} />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[13.5px] font-medium", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span>
          <span className="block truncate text-[11.5px] text-muted-foreground">{t.list.space.name} / {t.list.name}</span>
        </span>
        {t.priority && t.priority !== "NONE" && <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: PRIORITY[t.priority] ?? "#8a8f98" }} aria-label={`${t.priority.toLowerCase()} priority`} />}
        <span className="flex shrink-0 -space-x-1.5">{t.assignees.slice(0, 3).map((a) => <Avatar key={a.id} user={a} size={20} />)}</span>
        <span className={cn("w-[74px] shrink-0 text-right font-mono text-[11.5px]", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}</span>
      </button>
    </li>
  );
}

const DUE_COLOR: Record<string, string> = { Overdue: "#dc2626", Today: "#d97706", Upcoming: "#2563eb", "No due date": "#8a8f98" };

/** DM "Tasks" tab: open tasks of the people in this conversation */
export function DmTasks({ uid, others }: { uid: string; others: WorkUser[] }) {
  const [who, setWho] = useState<Who>("all");
  const [open, setOpen] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["work", "dm-tasks", uid, who], queryFn: () => workApi.dmTasks(uid, { who }) });
  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(+today + 86_400_000);
    const g: Record<string, DmTask[]> = { Overdue: [], Today: [], Upcoming: [], "No due date": [] };
    for (const t of data) {
      if (t.parentId) continue;
      const d = t.dueDate ? new Date(t.dueDate) : null;
      (d ? (d < today ? g.Overdue : d < tomorrow ? g.Today : g.Upcoming) : g["No due date"])!.push(t);
    }
    return Object.entries(g).filter(([, v]) => v.length);
  }, [data]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-2.5">
        <WhoFilter who={who} setWho={setWho} others={others} />
        <span className="font-mono text-[11.5px] text-muted-foreground">{data.filter((t) => !t.parentId).length} open</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {isLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> : (
          <TaskTable
            onOpen={setOpen}
            empty={<span className="flex flex-col items-center"><CircleCheck className="h-7 w-7 text-primary" /><span className="mt-2 text-[14px] font-semibold text-foreground">No open tasks</span><span className="mt-1 text-[12.5px]">Tasks assigned to people in this conversation show up here.</span></span>}
            groups={groups.map(([label, list]) => ({ name: label, color: DUE_COLOR[label] ?? "#8a8f98", items: list.map((t) => ({ ...t, where: { label: `${t.list.space.name} / ${t.list.name}` } })) }))}
          />
        )}
      </div>
      <TaskDrawer taskUid={open} onClose={() => setOpen(null)} onOpenTask={setOpen} />
    </div>
  );
}

/** DM "Calendar" tab: the same people's tasks on a month grid by due date */
export function DmCalendar({ uid, others }: { uid: string; others: WorkUser[] }) {
  const [who, setWho] = useState<Who>("all");
  return (
    <TaskMonthCalendar
      queryKey={["work", "dm-cal", uid, who]}
      load={(from, to) => workApi.dmTasks(uid, { who, from, to })}
      toolbar={<WhoFilter who={who} setWho={setWho} others={others} />}
    />
  );
}

type CalTask = Pick<DmTask, "id" | "uid" | "name" | "dueDate" | "completedAt" | "status">;

/** a month grid of tasks by due date; `load` gets the visible window (6 weeks) */
export function TaskMonthCalendar({ queryKey, load, toolbar }: { queryKey: unknown[]; load: (from: string, to: string) => Promise<CalTask[]>; toolbar?: React.ReactNode }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [open, setOpen] = useState<string | null>(null);
  const { from, to } = useMemo(() => monthWindow(month), [month]);
  const { data = [] } = useQuery({ queryKey: [...queryKey, from.toISOString()], queryFn: () => load(from.toISOString(), to.toISOString()) });
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <CalendarGrid month={month} onMonth={setMonth} items={data.map((t) => ({ id: t.id, uid: t.uid, name: t.name, dueDate: t.dueDate, completedAt: t.completedAt, color: t.status?.color }))} onOpen={setOpen} toolbar={toolbar} />
      <TaskDrawer taskUid={open} onClose={() => setOpen(null)} onOpenTask={setOpen} />
    </div>
  );
}
