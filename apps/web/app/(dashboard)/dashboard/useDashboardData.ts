"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import {
  getMemberTasks,
  getMemberActivity,
  type AssignedTask,
  type ActivityItem,
} from "@/services/tasks.api";
import { getMyMeetings, type Meeting } from "@/services/ceo-assistant.api";

/* ────────────────────────────────────────────────────────────────────────────
 * Status helpers — derive a normalized bucket + display color from a task's
 * free-form board status. Prefer the real board status color when present.
 * ──────────────────────────────────────────────────────────────────────────── */

export type StatusBucket = "done" | "in_progress" | "review" | "todo" | "overdue";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isDoneLabel(label: string | null) {
  if (!label) return false;
  return /done|complete|closed|finished|resolved/i.test(label);
}
function isReviewLabel(label: string | null) {
  if (!label) return false;
  return /review|qa|check|approv/i.test(label);
}
function isProgressLabel(label: string | null) {
  if (!label) return false;
  return /progress|working|doing|active|ongoing/i.test(label);
}

export function isOverdue(t: AssignedTask) {
  if (!t.dueDate) return false;
  if (isDoneLabel(t.statusLabel)) return false;
  return new Date(t.dueDate) < startOfToday();
}

export function taskBucket(t: AssignedTask): StatusBucket {
  if (isDoneLabel(t.statusLabel)) return "done";
  if (isOverdue(t)) return "overdue";
  if (isReviewLabel(t.statusLabel)) return "review";
  if (isProgressLabel(t.statusLabel)) return "in_progress";
  return "todo";
}

export const BUCKET_META: Record<StatusBucket, { label: string; color: string }> = {
  todo:        { label: "To Do",       color: "#3b82f6" },
  in_progress: { label: "In Progress", color: "#8b5cf6" },
  review:      { label: "Review",      color: "#f59e0b" },
  done:        { label: "Done",        color: "#10b981" },
  overdue:     { label: "Overdue",     color: "#f43f5e" },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Tasks across all the current user's workspaces (their own assigned tasks).
 * ──────────────────────────────────────────────────────────────────────────── */

export function useDashboardTasks() {
  const { user } = useAuth();
  const userId: number | undefined = user?.id;

  const workspaces: { id: number }[] = useMemo(
    () =>
      ((user?.workspaceMemberships ?? []) as any[])
        .map((m) => m.workspace)
        .filter((w) => w && typeof w.id === "number"),
    [user],
  );

  const results = useQueries({
    queries: workspaces.map((ws) => ({
      queryKey: ["dashboard", "member-tasks", ws.id, userId] as const,
      queryFn: () => getMemberTasks(ws.id, userId as number),
      enabled: typeof userId === "number" && typeof ws.id === "number",
      staleTime: 60_000,
    })),
  });

  const isLoading =
    typeof userId !== "number" ||
    (workspaces.length > 0 && results.some((r) => r.isLoading));

  const tasks: AssignedTask[] = useMemo(() => {
    const seen = new Set<number>();
    const out: AssignedTask[] = [];
    for (const r of results) {
      for (const t of r.data ?? []) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          out.push(t);
        }
      }
    }
    return out;
  }, [results]);

  return { tasks, isLoading, userId };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Derived aggregates used by KPI cards, charts and the distribution donut.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface DashboardAggregates {
  isLoading: boolean;
  totalTasks: number;
  overdueCount: number;
  teamMemberCount: number;
  distribution: { bucket: StatusBucket; label: string; color: string; count: number }[];
  /** 7-day window, oldest → newest */
  daily: { label: string; done: number; inProgress: number; overdue: number }[];
  tasks: AssignedTask[];
}

export function useDashboardAggregates(): DashboardAggregates {
  const { tasks, isLoading, userId } = useDashboardTasks();

  return useMemo(() => {
    const overdueCount = tasks.filter(isOverdue).length;

    // Distribution by normalized bucket (real board colors would vary per board,
    // so we normalize to a stable legend).
    const counts: Record<StatusBucket, number> = {
      todo: 0, in_progress: 0, review: 0, done: 0, overdue: 0,
    };
    for (const t of tasks) counts[taskBucket(t)] += 1;

    const distribution = (Object.keys(counts) as StatusBucket[])
      .map((b) => ({
        bucket: b,
        label: BUCKET_META[b].label,
        color: BUCKET_META[b].color,
        count: counts[b],
      }))
      .filter((d) => d.count > 0);

    // Unique collaborators across my tasks (excluding myself) → "Team Members"
    const memberIds = new Set<number>();
    for (const t of tasks) {
      for (const u of t.assignedUsers ?? []) {
        if (u.id !== userId) memberIds.add(u.id);
      }
    }

    // 7-day buckets by due date (today back 6 days)
    const today = startOfToday();
    const daily = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const label = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      let done = 0, inProgress = 0, overdue = 0;
      for (const t of tasks) {
        if (!t.dueDate) continue;
        const d = new Date(t.dueDate);
        if (d >= day && d < next) {
          const b = taskBucket(t);
          if (b === "done") done += 1;
          else if (b === "overdue") overdue += 1;
          else inProgress += 1;
        }
      }
      return { label, done, inProgress, overdue };
    });

    return {
      isLoading,
      totalTasks: tasks.length,
      overdueCount,
      teamMemberCount: memberIds.size,
      distribution,
      daily,
      tasks,
    };
  }, [tasks, isLoading, userId]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Recent activity — current user's own activity, merged across workspaces.
 * ──────────────────────────────────────────────────────────────────────────── */

export function useDashboardActivity() {
  const { user } = useAuth();
  const userId: number | undefined = user?.id;

  const workspaces: { id: number }[] = useMemo(
    () =>
      ((user?.workspaceMemberships ?? []) as any[])
        .map((m) => m.workspace)
        .filter((w) => w && typeof w.id === "number"),
    [user],
  );

  const results = useQueries({
    queries: workspaces.map((ws) => ({
      queryKey: ["dashboard", "member-activity", ws.id, userId] as const,
      queryFn: () => getMemberActivity(ws.id, userId as number),
      enabled: typeof userId === "number" && typeof ws.id === "number",
      staleTime: 60_000,
    })),
  });

  const isLoading =
    typeof userId !== "number" ||
    (workspaces.length > 0 && results.some((r) => r.isLoading));

  const items: ActivityItem[] = useMemo(() => {
    const seen = new Set<string>();
    const out: ActivityItem[] = [];
    for (const r of results) {
      for (const it of r.data ?? []) {
        const key = `${it.kind}-${it.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(it);
        }
      }
    }
    out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return out.slice(0, 8);
  }, [results]);

  return { items, isLoading };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Upcoming meetings — only meetings the signed-in user is attending/created.
 * This reads the CEO-namespace endpoint but never bypasses the passphrase that
 * protects the CEO dashboard page; non-authorized users simply get an empty
 * list (query fails soft, no retry).
 * ──────────────────────────────────────────────────────────────────────────── */

export function useDashboardMeetings() {
  const { user } = useAuth();
  const userId: number | undefined = user?.id;

  const query = useQuery({
    queryKey: ["dashboard", "my-meetings", userId],
    queryFn: () => getMyMeetings(),
    enabled: typeof userId === "number",
    staleTime: 60_000,
    retry: false,
  });

  const meetings: Meeting[] = useMemo(() => {
    const all = (query.data ?? []) as Meeting[];
    const mine = all.filter(
      (m) =>
        !m.cancelledAt &&
        (m.createdById === userId ||
          (m.attendees ?? []).some((a) => a.userId === userId)),
    );
    mine.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
    return mine.slice(0, 5);
  }, [query.data, userId]);

  return { meetings, isLoading: query.isLoading, isError: query.isError };
}
