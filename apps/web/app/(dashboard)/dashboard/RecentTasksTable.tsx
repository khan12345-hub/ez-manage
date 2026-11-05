"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckSquare, ListTodo } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveUrl } from "@/lib/resolveUrl";
import { useAuth } from "@/providers/AuthProvider";
import {
  useDashboardAggregates,
  taskBucket,
  type StatusBucket,
} from "./useDashboardData";
import type { AssignedTask } from "@/services/tasks.api";

type TabKey = "all" | "in_progress" | "overdue" | "done";

const TABS: { key: TabKey; label: string; match?: StatusBucket[] }[] = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In Progress", match: ["in_progress", "review", "todo"] },
  { key: "overdue", label: "Overdue", match: ["overdue"] },
  { key: "done", label: "Completed", match: ["done"] },
];

function formatDue(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecentTasksTable() {
  const { user } = useAuth();
  const { tasks, isLoading } = useDashboardAggregates();
  const [tab, setTab] = useState<TabKey>("all");

  // boardId → { workspaceRef, boardRef } for row navigation
  const boardLink = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of (user?.boardMemberships ?? []) as any[]) {
      const b = m.board;
      const ws = b?.workspace;
      if (b?.id && ws) {
        map.set(b.id, `/workspace/${ws.uid ?? ws.id}/board/${b.uid ?? b.id}`);
      }
    }
    return map;
  }, [user]);

  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [tasks],
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: sorted.length, in_progress: 0, overdue: 0, done: 0 };
    for (const t of sorted) {
      const b = taskBucket(t);
      if (b === "overdue") c.overdue += 1;
      else if (b === "done") c.done += 1;
      else c.in_progress += 1;
    }
    return c;
  }, [sorted]);

  const filtered = useMemo(() => {
    const def = TABS.find((t) => t.key === tab);
    if (!def?.match) return sorted;
    return sorted.filter((t) => def.match!.includes(taskBucket(t)));
  }, [sorted, tab]);

  const rows = filtered.slice(0, 6);

  return (
    <div
      className="rounded-2xl bg-card"
      style={{
        border: "1px solid rgba(99, 102, 241, 0.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(99,102,241,0.1)" }}>
            <CheckSquare className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Recent Tasks</h3>
        </div>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={
                active
                  ? { background: "#6366f1", color: "white" }
                  : { background: "rgba(99,102,241,0.07)", color: "#64748b" }
              }
            >
              {t.label} ({counts[t.key]})
            </button>
          );
        })}
      </div>

      {/* body */}
      {isLoading ? (
        <div className="space-y-3 px-5 pb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
          <ListTodo className="h-9 w-9 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">No tasks here</p>
          <p className="text-xs text-muted-foreground">Nothing matches this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-y text-[11px] uppercase tracking-wide text-muted-foreground" style={{ borderColor: "rgba(99,102,241,0.08)" }}>
                <th className="px-5 py-2.5 font-medium">Task</th>
                <th className="px-3 py-2.5 font-medium">Board</th>
                <th className="px-3 py-2.5 font-medium">Assignee</th>
                <th className="px-3 py-2.5 font-medium">Due Date</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, idx) => (
                <TaskRow key={t.id} task={t} href={boardLink.get(t.boardId)} index={idx} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  href,
  index,
}: {
  task: AssignedTask;
  href?: string;
  index: number;
}) {
  const router = useRouter();
  const bucket = taskBucket(task);
  const statusColor = task.statusColor || STATUS_FALLBACK[bucket];
  const statusLabel = task.statusLabel || STATUS_LABEL[bucket];

  const content = (
    <>
      <td className="px-5 py-3">
        <p className="truncate text-sm font-medium text-foreground">{task.name}</p>
      </td>
      <td className="px-3 py-3">
        <span className="truncate text-xs text-primary">{task.boardName}</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex -space-x-2">
          {(task.assignedUsers ?? []).slice(0, 3).map((u) => {
            const url = resolveUrl(u.avatarUrl) || undefined;
            const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
            return (
              <Avatar key={u.id} className="h-6 w-6 ring-2 ring-card">
                {url && <AvatarImage src={url} alt={u.firstName} />}
                <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
            );
          })}
          {(task.assignedUsers?.length ?? 0) > 3 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-border text-[9px] font-semibold text-muted-foreground ring-2 ring-card">
              +{(task.assignedUsers!.length) - 3}
            </span>
          )}
          {(task.assignedUsers?.length ?? 0) === 0 && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDue(task.dueDate)}</span>
      </td>
      <td className="px-5 py-3">
        <span
          className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{ background: `${statusColor}1f`, color: statusColor }}
        >
          {statusLabel}
        </span>
      </td>
    </>
  );

  const rowCn =
    "border-b transition-colors last:border-0 hover:bg-accent";
  const rowStyle = { borderColor: "rgba(99,102,241,0.06)" };

  if (href) {
    return (
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.04 }}
        className={`${rowCn} cursor-pointer`}
        style={rowStyle}
        onClick={() => router.push(href)}
      >
        {content}
      </motion.tr>
    );
  }

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.04 }}
      className={rowCn}
      style={rowStyle}
    >
      {content}
    </motion.tr>
  );
}

const STATUS_FALLBACK: Record<StatusBucket, string> = {
  todo: "#3b82f6",
  in_progress: "#8b5cf6",
  review: "#f59e0b",
  done: "#10b981",
  overdue: "#f43f5e",
};
const STATUS_LABEL: Record<StatusBucket, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  overdue: "Overdue",
};
