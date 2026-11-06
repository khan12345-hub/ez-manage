"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, List as ListIcon, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ListView } from "../../../_components/ListView";
import { BoardView } from "../../../_components/BoardView";
import { CalendarView } from "../../../_components/CalendarView";
import { TaskDrawer } from "../../../_components/TaskDrawer";
import { useListTasks, useWorkList } from "../../../_components/hooks";

type View = "list" | "board" | "calendar";
const VIEWS: { id: View; label: string; icon: typeof ListIcon }[] = [
  { id: "list", label: "List", icon: ListIcon },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

function ListPageInner() {
  const { listUid } = useParams<{ workspaceId: string; listUid: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user } = useAuth();
  const view = (["list", "board", "calendar"].includes(sp.get("view") ?? "") ? sp.get("view") : "list") as View;
  const taskUid = sp.get("task");

  const { data: list, isLoading, isError } = useWorkList(listUid);
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks(list?.id);
  const [q, setQ] = useState("");
  const [meMode, setMeMode] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    value === null ? next.delete(key) : next.set(key, value);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const openTask = (uid: string) => setParam("task", uid);

  // Search + "Me mode" (only my tasks). Keep a subtask's parent visible when the subtask matches.
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term && !meMode) return tasks;
    const match = (t: (typeof tasks)[number]) =>
      (!term || t.name.toLowerCase().includes(term)) && (!meMode || t.assignees.some((a) => a.id === user?.id));
    const keep = new Set<number>();
    for (const t of tasks) if (match(t)) {
      keep.add(t.id);
      if (t.parentId) keep.add(t.parentId);
    }
    return tasks.filter((t) => keep.has(t.id));
  }, [tasks, q, meMode, user?.id]);

  if (isError) {
    return <div className="p-10 text-center text-sm text-muted-foreground">This list doesn&apos;t exist, was archived, or you don&apos;t have access.</div>;
  }

  const open = tasks.filter((t) => !t.parentId && !t.completedAt).length;
  const doneCount = tasks.filter((t) => !t.parentId && t.completedAt).length;

  return (
    <div className="flex min-h-full flex-col">
      {/* header */}
      <div className="relative border-b border-border bg-card px-4 pb-0 pt-4 sm:px-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--primary) 0%, var(--brass) 60%, transparent 100%)" }} />
        <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-product-work" aria-hidden />
          Work
          {list && (
            <>
              <span aria-hidden>/</span>
              <span className="normal-case tracking-normal">{list.space.name}</span>
              {list.folder && (
                <>
                  <span aria-hidden>/</span>
                  <span className="normal-case tracking-normal">{list.folder.name}</span>
                </>
              )}
            </>
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-serif text-[30px] font-normal leading-tight tracking-tight sm:text-[34px]">{list?.name ?? (isLoading ? "…" : "")}</h1>
          {list && (
            <p className="pb-1.5 font-mono text-[12px] text-muted-foreground">
              {open} open · {doneCount} done
            </p>
          )}
        </div>
        {/* views */}
        <div role="tablist" aria-label="Views" className="-mb-px mt-2 flex gap-1">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              type="button"
              onClick={() => setParam("view", id === "list" ? null : id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                view === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
        <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-border bg-card px-2.5 sm:max-w-xs">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground" />
        </label>
        <button
          type="button"
          aria-pressed={meMode}
          onClick={() => setMeMode((m) => !m)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors",
            meMode ? "border-primary/40 bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <User className="h-4 w-4" /> Me mode
        </button>
      </div>

      <div className="flex-1 px-4 py-4 sm:px-6">
        {(isLoading || tasksLoading || !list) ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        ) : view === "board" ? (
          <BoardView list={list} tasks={shown} onOpenTask={openTask} />
        ) : view === "calendar" ? (
          <CalendarView list={list} tasks={shown} onOpenTask={openTask} />
        ) : (
          <ListView list={list} tasks={shown} onOpenTask={openTask} />
        )}
      </div>

      <TaskDrawer taskUid={taskUid} onClose={() => setParam("task", null)} onOpenTask={openTask} />
    </div>
  );
}

export default function WorkListPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}>
      <ListPageInner />
    </Suspense>
  );
}
