"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, List as ListIcon, Plus } from "lucide-react";
import { pushRecentList, useWorkCreate } from "@/store/work-create";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ListView } from "../../../_components/ListView";
import { BoardView } from "../../../_components/BoardView";
import { CalendarView } from "../../../_components/CalendarView";
import { TaskDrawer } from "../../../_components/TaskDrawer";
import { useListTasks, useWorkList } from "../../../_components/hooks";
import { ListToolbar } from "../../../_components/ListToolbar";
import { DEFAULT_VIEW, filterTasks, loadView, sameView, saveView, type ViewSettings } from "../../../_components/viewSettings";

type View = "list" | "board" | "calendar";
const VIEWS: { id: View; label: string; icon: typeof ListIcon }[] = [
  { id: "list", label: "List", icon: ListIcon },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

function ListPageInner() {
  const { listUid, workspaceId } = useParams<{ workspaceId: string; listUid: string }>();
  const openCreate = useWorkCreate((st) => st.openCreate);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user } = useAuth();
  const view = (["list", "board", "calendar"].includes(sp.get("view") ?? "") ? sp.get("view") : "list") as View;
  const taskUid = sp.get("task");

  const { data: list, isLoading, isError } = useWorkList(listUid);
  useEffect(() => {
    if (list) pushRecentList(workspaceId, list.uid);
  }, [list?.uid, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks(list?.id);
  const [q, setQ] = useState("");
  const [meMode, setMeMode] = useState(false);
  // view settings: the saved copy (localStorage) and the working copy
  const [saved, setSaved] = useState<ViewSettings>(DEFAULT_VIEW);
  const [vs, setVs] = useState<ViewSettings>(DEFAULT_VIEW);
  useEffect(() => {
    const v = loadView(listUid);
    setSaved(v);
    setVs(v);
  }, [listUid]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    value === null ? next.delete(key) : next.set(key, value);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const openTask = (uid: string) => setParam("task", uid);

  // Search + "Me mode" (only my tasks). Keep a subtask's parent visible when the subtask matches.
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = list ? filterTasks(tasks, vs, list.statuses) : tasks;
    if (!term && !meMode) return base;
    const match = (t: (typeof tasks)[number]) =>
      (!term || t.name.toLowerCase().includes(term)) && (!meMode || t.assignees.some((a) => a.id === user?.id));
    const keep = new Set<number>();
    for (const t of base) if (match(t)) {
      keep.add(t.id);
      if (t.parentId) keep.add(t.parentId);
    }
    return base.filter((t) => keep.has(t.id));
  }, [tasks, list, vs, q, meMode, user?.id]);

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
            <div className="flex items-center gap-3 pb-1.5">
              <p className="font-mono text-[12px] text-muted-foreground">
                {open} open · {doneCount} done
              </p>
              {list.access.canEdit && (
                <button
                  type="button"
                  onClick={() => openCreate(list.uid)}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground shadow-sm hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Task
                </button>
              )}
            </div>
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
      {list && (
        <div className="px-4 pt-4 sm:px-6">
          <ListToolbar
            list={list}
            tasks={tasks}
            view={vs}
            onView={setVs}
            dirty={!sameView(vs, saved)}
            onSave={() => {
              saveView(listUid, vs);
              setSaved(vs);
              toast.success("View saved");
            }}
            onReset={() => setVs(saved)}
            q={q}
            onQ={setQ}
            meMode={meMode}
            onMeMode={setMeMode}
            showListControls={view === "list"}
          />
        </div>
      )}

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
          <ListView list={list} tasks={shown} view={vs} onView={setVs} onOpenTask={openTask} />
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
