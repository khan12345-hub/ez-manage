"use client";

/* Work Inbox model: notification kinds, importance (Primary vs Other), settings, grouping. */

import type { StatusCategory } from "@/services/work.api";

export interface InboxNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
  clearedAt: string | null;
  snoozedUntil: string | null;
  task: { name: string; status: { name: string; color: string; category: StatusCategory } | null; dueDate: string | null; completedAt: string | null; archived: boolean } | null;
}

export type Kind = "mention" | "assigned" | "assigned_comment" | "reply" | "comment" | "status" | "overdue" | "added";

export const KIND_META: Record<Kind, { label: string; hint: string }> = {
  mention: { label: "Mentions", hint: "Someone @mentions you" },
  assigned: { label: "Assigned to me", hint: "A task is assigned to you" },
  assigned_comment: { label: "Assigned comments", hint: "A comment is assigned to you" },
  reply: { label: "Replies", hint: "Someone replies in a thread" },
  comment: { label: "Comments", hint: "New comments on your tasks" },
  status: { label: "Status changes", hint: "Status changes on your tasks" },
  overdue: { label: "Overdue tasks", hint: "Your task passed its due date" },
  added: { label: "Access", hint: "You were added to Work or a space" },
};
export const ALL_KINDS = Object.keys(KIND_META) as Kind[];

export function kindOf(n: Pick<InboxNotification, "type" | "metadata">): Kind {
  const e = n.metadata?.event as Kind | undefined;
  if (e && e in KIND_META) return e;
  if (n.type === "COMMENT_MENTION") return "mention";
  if (n.type === "TASK_ASSIGNED") return "assigned";
  if (n.metadata?.assignedComment) return "assigned_comment";
  if (n.type === "COMMENT_REPLY") return "reply";
  if (n.type === "TASK_STATUS_CHANGED") return "status";
  if (n.type === "TASK_DUE_SOON") return "overdue";
  if (n.type === "WORKSPACE_MEMBER_ADDED") return "added";
  return "comment";
}

export interface InboxSettings {
  showAll: boolean;
  groupByDate: boolean;
  newestFirst: boolean;
  display: "fullscreen" | "inline";
  /** kinds that go to Primary; the rest go to Other */
  important: Kind[];
}

export const DEFAULT_SETTINGS: InboxSettings = {
  showAll: false,
  groupByDate: true,
  newestFirst: true,
  display: "fullscreen",
  important: ["mention", "assigned", "assigned_comment", "reply", "status", "overdue"],
};

const KEY = "ez:work:inbox:settings";
export function loadSettings(): InboxSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...v, important: Array.isArray(v.important) ? v.important.filter((k: string) => k in KIND_META) : DEFAULT_SETTINGS.important };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: InboxSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** One row = all events on the same task (latest first); non-task events stay single. */
export interface InboxRow {
  key: string;
  ids: string[];
  latest: InboxNotification;
  events: InboxNotification[];
  unread: boolean;
  at: string;
}

export function groupRows(items: InboxNotification[], newestFirst: boolean): InboxRow[] {
  const map = new Map<string, InboxNotification[]>();
  for (const n of items) {
    const k = n.metadata?.taskUid ? `t:${n.metadata.taskUid}` : `n:${n.id}`;
    map.set(k, [...(map.get(k) ?? []), n]);
  }
  const rows = [...map.entries()].map(([key, evs]) => {
    const sorted = [...evs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return { key, ids: sorted.map((e) => e.id), latest: sorted[0]!, events: sorted, unread: sorted.some((e) => !e.isRead), at: sorted[0]!.createdAt };
  });
  rows.sort((a, b) => (+new Date(b.at) - +new Date(a.at)) * (newestFirst ? 1 : -1));
  return rows;
}

export function dateBucket(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((t.getTime() - day) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Last 7 days";
  return "Older";
}
export const BUCKET_ORDER = ["Today", "Yesterday", "Last 7 days", "Older"];

export function relDays(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const n = Math.round((t.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  return n <= 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`;
}

export function timeLabel(iso: string) {
  const d = new Date(iso);
  if (dateBucket(iso) === "Today") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
