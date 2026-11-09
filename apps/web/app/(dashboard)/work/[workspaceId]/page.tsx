"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { dayOf, workApi, workKeys, type MyWorkTask } from "@/services/work.api";
import { DueLabel, PriorityFlag, StatusGlyph } from "../_components/primitives";
import { TaskDrawer } from "../_components/TaskDrawer";
import { NameDialog } from "../_components/NameDialog";

type Bucket = "overdue" | "today" | "week" | "later" | "none";
const BUCKETS: { id: Bucket; label: string; tone: string }[] = [
  { id: "overdue", label: "Overdue", tone: "text-destructive" },
  { id: "today", label: "Today", tone: "text-[#b45309] dark:text-brass-soft" },
  { id: "week", label: "Next 7 days", tone: "text-primary" },
  { id: "later", label: "Later", tone: "text-muted-foreground" },
  { id: "none", label: "No due date", tone: "text-muted-foreground" },
];

function bucketOf(t: MyWorkTask, today: Date): Bucket {
  if (!t.dueDate) return "none";
  const d = dayOf(t.dueDate).getTime();
  const t0 = today.getTime();
  if (d < t0) return "overdue";
  if (d === t0) return "today";
  if (d <= t0 + 7 * 86_400_000) return "week";
  return "later";
}

function MyWorkInner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const taskUid = sp.get("task");
  // My Tasks → "Assigned to me" (all) or "Today & Overdue"
  const todayOnly = sp.get("view") === "today";
  const [showDone, setShowDone] = useState(false);
  const [newSpace, setNewSpace] = useState(false);

  const { data: tree } = useQuery({ queryKey: workKeys.tree(workspaceId), queryFn: () => workApi.tree(workspaceId), staleTime: 30_000 });
  const { data: tasks = [], isLoading } = useQuery({ queryKey: workKeys.my(workspaceId), queryFn: () => workApi.myTasks(workspaceId) });

  const setTask = (uid: string | null) => {
    const next = new URLSearchParams(sp.toString());
    uid ? next.set("task", uid) : next.delete("task");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = tasks.filter((t) => !t.completedAt && !t.parentId);
    const m = new Map<Bucket, MyWorkTask[]>(BUCKETS.map((b) => [b.id, []]));
    for (const t of open) m.get(bucketOf(t, today))!.push(t);
    return { m, open, done: tasks.filter((t) => t.completedAt) };
  }, [tasks]);

  const noSpaces = tree && tree.spaces.length === 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="w-full px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-product-work" aria-hidden /> Work · My Tasks · {todayOnly ? "Today & Overdue" : "Assigned to me"}
          </p>
          <h1 className="mt-2 font-serif text-[36px] font-normal leading-tight tracking-tight">
            {greeting}, <span className="italic text-primary">{user?.firstName ?? "there"}.</span>
          </h1>
        </div>
        <dl className="flex divide-x divide-border rounded-xl border border-border bg-card px-1 py-2.5">
          {[
            { k: "overdue", label: "overdue", v: grouped.m.get("overdue")!.length, tone: "text-destructive" },
            { k: "today", label: "today", v: grouped.m.get("today")!.length, tone: "text-[#b45309] dark:text-brass-soft" },
            { k: "open", label: "open", v: grouped.open.length, tone: "text-foreground" },
          ].map((s) => (
            <div key={s.k} className="px-4 text-right">
              <dd className={cn("font-serif text-[28px] leading-none tabular-nums", s.tone)}>{isLoading ? "–" : s.v}</dd>
              <dt className="mt-1 text-[11.5px] text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      </header>

      {noSpaces && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="font-serif text-[26px] font-normal">Set up Work for this workspace</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
            Work is organised as <strong className="text-foreground">Spaces → Folders → Lists → Tasks</strong>. Start with a space for a team or department.
          </p>
          {tree?.access.canManage ? (
            <button type="button" onClick={() => setNewSpace(true)} className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2.5 text-[13.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
              <Plus className="h-4 w-4" /> Create your first space
            </button>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">Ask a workspace owner or admin to create a space.</p>
          )}
        </section>
      )}

      {!noSpaces && (
        <div className="mt-8 space-y-5">
          {isLoading && [0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
          {!isLoading && grouped.open.length === 0 && (
            <section className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
              <p className="font-serif text-[22px]">Nothing assigned to you</p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">Tasks you&apos;re assigned to in any list will appear here.</p>
            </section>
          )}
          {!isLoading && todayOnly && grouped.m.get("overdue")!.length + grouped.m.get("today")!.length === 0 && grouped.open.length > 0 && (
            <section className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
              <p className="font-serif text-[22px]">Nothing due today or overdue</p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">You&apos;re on track. Upcoming tasks are under Assigned to me.</p>
            </section>
          )}
          {!isLoading && BUCKETS.filter((b) => !todayOnly || b.id === "overdue" || b.id === "today").map((b) => {
            const items = grouped.m.get(b.id)!;
            if (!items.length) return null;
            return (
              <section key={b.id} aria-label={b.label} className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04)]">
                <header className="flex items-baseline gap-2 bg-table-head px-4 py-2.5">
                  <h2 className={cn("text-[13px] font-bold uppercase tracking-[0.06em]", b.tone)}>{b.label}</h2>
                  <span className="font-mono text-[12px] text-muted-foreground">{items.length}</span>
                </header>
                <ul>
                  {items.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => setTask(t.uid)} className="flex w-full items-center gap-3 border-t border-border/70 px-4 py-2.5 text-left transition-colors hover:bg-accent/30">
                        <StatusGlyph status={t.status} size={15} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{t.name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
                            <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: t.list.space.color }} aria-hidden />
                            {t.list.space.name} / {t.list.name}
                          </span>
                        </span>
                        {t.priority && <PriorityFlag priority={t.priority} />}
                        <DueLabel task={t} className="w-[76px] text-right" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {grouped.done.length > 0 && (
            <button type="button" onClick={() => setShowDone((s) => !s)} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
              {showDone ? "Hide" : "Show"} {grouped.done.length} completed
            </button>
          )}
          {showDone && (
            <ul className="overflow-hidden rounded-xl border border-border bg-card">
              {grouped.done.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setTask(t.uid)} className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-2 text-left text-[13.5px] text-muted-foreground line-through last:border-b-0 hover:bg-accent/30">
                    <StatusGlyph status={t.status} size={14} />
                    <span className="truncate">{t.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <TaskDrawer taskUid={taskUid} onClose={() => setTask(null)} onOpenTask={(uid) => setTask(uid)} />
      <NameDialog
        open={newSpace}
        onOpenChange={setNewSpace}
        title="New space"
        description="A space holds a team's folders, lists and statuses."
        placeholder="e.g. Marketing"
        withColor
        withPrivacy
        onSubmit={async (r) => {
          await workApi.createSpace(workspaceId, { name: r.name, color: r.color, isPrivate: r.isPrivate });
          await qc.invalidateQueries({ queryKey: workKeys.tree(workspaceId) });
        }}
      />
    </div>
  );
}

export default function MyWorkPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}>
      <MyWorkInner />
    </Suspense>
  );
}
