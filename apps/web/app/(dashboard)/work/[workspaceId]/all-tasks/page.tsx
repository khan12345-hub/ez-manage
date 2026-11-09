"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronRight, Layers, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { workApi, type MyWorkTask } from "@/services/work.api";
import { AvatarStack, DueLabel, PriorityFlag, StatusGlyph } from "../../_components/primitives";
import { TaskDrawer } from "../../_components/TaskDrawer";

type GroupBy = "status" | "list";
const CATS = [
  { key: "NOT_STARTED", label: "To do", color: "#87909E" },
  { key: "ACTIVE", label: "In progress", color: "#2563EB" },
  { key: "DONE", label: "Complete", color: "#16A34A" },
] as const;

/** All Tasks (ClickUp): every task you can see in this workspace, across spaces and lists. */
function AllTasksInner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const taskUid = sp.get("task");
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [showClosed, setShowClosed] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["work", "all-tasks", workspaceId], queryFn: () => workApi.allTasks(workspaceId) });
  const { data: workspaces = [] } = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, staleTime: 30_000 });
  const wsName = workspaces.find((w) => w.uid === workspaceId)?.name ?? "";

  const term = q.trim().toLowerCase();
  const shown = tasks.filter((t) => (showClosed || !t.completedAt) && (!term || `${t.name} ${t.list.name} ${t.list.space.name}`.toLowerCase().includes(term)));
  const groups = useMemo(() => {
    if (groupBy === "status") {
      return CATS.filter((c) => showClosed || c.key !== "DONE").map((c) => ({ key: c.key, label: c.label, color: c.color, tasks: shown.filter((t) => (t.status?.category ?? "NOT_STARTED") === c.key) }));
    }
    const m = new Map<string, { key: string; label: string; color: string; tasks: MyWorkTask[] }>();
    for (const t of shown) {
      const k = t.list.uid;
      if (!m.has(k)) m.set(k, { key: k, label: `${t.list.space.name} / ${t.list.name}`, color: t.list.space.color, tasks: [] });
      m.get(k)!.tasks.push(t);
    }
    return [...m.values()];
  }, [shown, groupBy, showClosed]);

  const setTask = (uid: string | null) => {
    const next = new URLSearchParams(sp.toString());
    uid ? next.set("task", uid) : next.delete("task");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="border-b border-border bg-card px-4 pb-3 pt-4 sm:px-6">
        <h1 className="text-[18px] font-semibold">All Tasks {wsName && <span className="font-normal text-muted-foreground">· {wsName}</span>}</h1>
        <p className="text-[12.5px] text-muted-foreground">Every task you can see, across all spaces and lists.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-6">
        <div className="flex rounded-full border border-border bg-card p-0.5">
          {(["status", "list"] as const).map((g) => (
            <button key={g} type="button" aria-pressed={groupBy === g} onClick={() => setGroupBy(g)} className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-medium", groupBy === g ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Layers className="h-3.5 w-3.5" /> Group: {g === "status" ? "Status" : "List"}
            </button>
          ))}
        </div>
        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 text-[12.5px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> Closed <Switch checked={showClosed} onCheckedChange={setShowClosed} aria-label="Show closed tasks" className="scale-75" />
        </label>
        <span className="flex-1" />
        <label className="flex h-8 w-[240px] items-center gap-2 rounded-md border border-border bg-card px-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-6">
        {isLoading && [0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        {!isLoading && shown.length === 0 && <p className="py-20 text-center text-[13px] text-muted-foreground">{term ? "No tasks match." : "No tasks yet."}</p>}
        {!isLoading &&
          groups.filter((g) => g.tasks.length).map((g) => (
            <section key={g.key} aria-label={g.label} className="overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center gap-2 bg-table-head px-3 py-2">
                <button type="button" aria-label={collapsed[g.key] ? `Expand ${g.label}` : `Collapse ${g.label}`} onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))} className="rounded p-0.5 text-muted-foreground hover:bg-card">
                  {collapsed[g.key] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <span className="rounded-md px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.05em] text-white" style={{ background: g.color }}>{g.label}</span>
                <span className="font-mono text-[12px] text-muted-foreground">{g.tasks.length}</span>
              </header>
              {!collapsed[g.key] && (
                <>
                  <div className="grid grid-cols-[minmax(240px,1fr)_220px_110px_110px_96px] items-center border-t border-border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                    <span className="pl-6">Name</span><span>List</span><span>Assignee</span><span>Due date</span><span>Priority</span>
                  </div>
                  {g.tasks.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTask(t.uid)} className="grid w-full grid-cols-[minmax(240px,1fr)_220px_110px_110px_96px] items-center border-t border-border/70 px-3 py-2 text-left text-[14px] hover:bg-accent/30">
                      <span className="flex min-w-0 items-center gap-2">
                        <StatusGlyph status={t.status} size={15} />
                        <span className={cn("truncate", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span>
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.list.space.color }} />
                        <span className="truncate">{t.list.space.name} / {t.list.name}</span>
                      </span>
                      <span><AvatarStack users={t.assignees} size={22} /></span>
                      <span>{t.dueDate ? <DueLabel task={t} className="text-[12.5px]" /> : <span className="text-muted-foreground/50">—</span>}</span>
                      <span><PriorityFlag priority={t.priority} showLabel={!!t.priority} /></span>
                    </button>
                  ))}
                </>
              )}
            </section>
          ))}
      </div>

      <TaskDrawer taskUid={taskUid} onClose={() => setTask(null)} onOpenTask={(uid) => setTask(uid)} />
    </div>
  );
}

export default function AllTasksPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}>
      <AllTasksInner />
    </Suspense>
  );
}
