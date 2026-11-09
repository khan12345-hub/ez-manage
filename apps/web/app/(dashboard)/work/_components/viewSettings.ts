"use client";

/* List-view settings (ClickUp-style toolbar): group by, subtasks, columns,
   filters, closed toggle, sort. Persisted per list with "Save view". */

import { PRIORITY_META, dayOf, isTaskOverdue, userName, type WorkListDetail, type WorkStatus, type WorkTask } from "@/services/work.api";

export type GroupBy = "status" | "assignee" | "priority" | "due" | "none";
export type ColumnKey = "assignee" | "due" | "priority" | "start" | "estimate" | "tags" | "created";
/** a built-in column, or a custom field column "cf:<fieldId>" */
export type Col = ColumnKey | `cf:${number}`;
export const isCf = (c: Col): c is `cf:${number}` => c.startsWith("cf:");
export const cfId = (c: `cf:${number}`) => Number(c.slice(3));
export const cfCol = (id: number) => `cf:${id}` as const;
const CF_WIDTH: Record<string, number> = { textarea: 200, labels: 170, people: 120, checkbox: 90, rating: 110, progress: 140, url: 170 };
/** label + width of any column; custom fields need the space's field list */
export function colMeta(c: Col, fields: { id: number; name: string; type: string }[] = []): { label: string; width: number; sort?: SortKey } {
  if (!isCf(c)) return COLUMN_META[c];
  const f = fields.find((x) => x.id === cfId(c));
  return { label: f?.name ?? "Field", width: CF_WIDTH[f?.type ?? ""] ?? 150 };
}
export type SortKey = "name" | "due" | "priority" | "start" | "estimate" | "created";
export type DueBucket = "overdue" | "today" | "week" | "later" | "none";

export interface ViewSettings {
  groupBy: GroupBy;
  subtasks: "collapsed" | "expanded";
  columns: Col[];
  showClosed: boolean;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  filters: {
    statusIds: number[];
    assigneeIds: number[]; // 0 = unassigned
    priorities: string[]; // "NONE" = no priority
    due: DueBucket[];
    tagIds: number[];
  };
  hiddenGroups: string[];
  /** per-column "Calculate" choice for group footers */
  calcs?: Record<string, "none" | "sum" | "avg" | "min" | "max" | "filled" | "empty" | "pct">;
}

export const DEFAULT_VIEW: ViewSettings = {
  groupBy: "status",
  subtasks: "collapsed",
  columns: ["assignee", "due", "priority"],
  showClosed: true,
  sort: null,
  filters: { statusIds: [], assigneeIds: [], priorities: [], due: [], tagIds: [] },
  hiddenGroups: [],
};

export const COLUMN_META: Record<ColumnKey, { label: string; width: number; sort?: SortKey }> = {
  assignee: { label: "Assignee", width: 120 },
  due: { label: "Due date", width: 112, sort: "due" },
  priority: { label: "Priority", width: 96, sort: "priority" },
  start: { label: "Start date", width: 104, sort: "start" },
  estimate: { label: "Estimate", width: 92, sort: "estimate" },
  tags: { label: "Tags", width: 150 },
  created: { label: "Created", width: 104, sort: "created" },
};
export const ALL_COLUMNS = Object.keys(COLUMN_META) as ColumnKey[];

const storageKey = (listUid: string) => `ez:work:view:${listUid}`;

export function loadView(listUid: string): ViewSettings {
  try {
    const raw = localStorage.getItem(storageKey(listUid));
    if (!raw) return DEFAULT_VIEW;
    const v = JSON.parse(raw);
    return { ...DEFAULT_VIEW, ...v, filters: { ...DEFAULT_VIEW.filters, ...(v.filters ?? {}) } };
  } catch {
    return DEFAULT_VIEW;
  }
}

export function saveView(listUid: string, v: ViewSettings) {
  try {
    localStorage.setItem(storageKey(listUid), JSON.stringify(v));
  } catch {}
}

export const sameView = (a: ViewSettings, b: ViewSettings) => JSON.stringify(a) === JSON.stringify(b);

export function activeFilterCount(v: ViewSettings) {
  const f = v.filters;
  return f.statusIds.length + f.assigneeIds.length + f.priorities.length + f.due.length + f.tagIds.length;
}

export function dueBucket(t: Pick<WorkTask, "dueDate" | "completedAt">): DueBucket {
  if (!t.dueDate) return "none";
  if (isTaskOverdue(t)) return "overdue";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = dayOf(t.dueDate).getTime();
  if (d === today.getTime()) return "today";
  if (d <= today.getTime() + 7 * 86_400_000) return "week";
  return "later";
}

/** Apply filters + closed toggle. A parent stays visible when one of its subtasks matches. */
export function filterTasks(tasks: WorkTask[], v: ViewSettings, statuses: WorkStatus[]): WorkTask[] {
  const f = v.filters;
  const doneIds = new Set(statuses.filter((s) => s.category === "DONE").map((s) => s.id));
  const match = (t: WorkTask) =>
    (v.showClosed || !(t.statusId && doneIds.has(t.statusId))) &&
    (!f.statusIds.length || (t.statusId != null && f.statusIds.includes(t.statusId))) &&
    (!f.assigneeIds.length || (t.assignees.length ? t.assignees.some((a) => f.assigneeIds.includes(a.id)) : f.assigneeIds.includes(0))) &&
    (!f.priorities.length || f.priorities.includes(t.priority ?? "NONE")) &&
    (!f.due.length || f.due.includes(dueBucket(t))) &&
    (!f.tagIds.length || t.tags?.some((x) => f.tagIds.includes(x.id)));
  const keep = new Set<number>();
  for (const t of tasks) if (match(t)) {
    keep.add(t.id);
    if (t.parentId) keep.add(t.parentId);
  }
  return tasks.filter((t) => keep.has(t.id));
}

const PRIORITY_RANK = (p: string | null) => (p ? PRIORITY_META[p as keyof typeof PRIORITY_META]?.rank ?? 9 : 9);

export function sortTasks(tasks: WorkTask[], sort: ViewSettings["sort"]): WorkTask[] {
  if (!sort) return tasks;
  const dir = sort.dir === "asc" ? 1 : -1;
  const val = (t: WorkTask): number | string => {
    switch (sort.key) {
      case "name": return t.name.toLowerCase();
      case "due": return t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      case "start": return t.startDate ? new Date(t.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      case "priority": return PRIORITY_RANK(t.priority);
      case "estimate": return t.timeEstimate ?? Number.MAX_SAFE_INTEGER;
      case "created": return new Date(t.createdAt).getTime();
    }
  };
  return [...tasks].sort((a, b) => {
    const x = val(a), y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

export interface TaskGroup {
  key: string;
  label: string;
  color: string;
  status?: WorkStatus;
  /** values a task created in this group starts with */
  createDefaults: { statusId?: number; assigneeIds?: number[]; priority?: WorkTask["priority"] };
  tasks: WorkTask[];
}

const DUE_GROUPS: { key: DueBucket; label: string; color: string }[] = [
  { key: "overdue", label: "Overdue", color: "#DC2626" },
  { key: "today", label: "Today", color: "#B45309" },
  { key: "week", label: "Next 7 days", color: "#047857" },
  { key: "later", label: "Later", color: "#475569" },
  { key: "none", label: "No due date", color: "#9CA3AF" },
];

/** Group root tasks (subtasks stay under their parents). */
export function groupTasks(roots: WorkTask[], v: ViewSettings, list: WorkListDetail): TaskGroup[] {
  switch (v.groupBy) {
    case "status": {
      const g: TaskGroup[] = list.statuses.map((s) => ({
        key: `s${s.id}`, label: s.name, color: s.color, status: s, createDefaults: { statusId: s.id },
        tasks: roots.filter((t) => t.statusId === s.id),
      }));
      const orphan = roots.filter((t) => !t.statusId || !list.statuses.some((s) => s.id === t.statusId));
      if (orphan.length) g.push({ key: "s0", label: "No status", color: "#9CA3AF", createDefaults: {}, tasks: orphan });
      return g;
    }
    case "assignee": {
      const people = list.members.filter((m) => roots.some((t) => t.assignees.some((a) => a.id === m.id)));
      const g: TaskGroup[] = people.map((m) => ({
        key: `a${m.id}`, label: userName(m), color: "#0b2a1f", createDefaults: { assigneeIds: [m.id] },
        tasks: roots.filter((t) => t.assignees.some((a) => a.id === m.id)),
      }));
      g.push({ key: "a0", label: "Unassigned", color: "#9CA3AF", createDefaults: {}, tasks: roots.filter((t) => !t.assignees.length) });
      return g;
    }
    case "priority":
      return [...(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => ({
        key: `p${p}`, label: PRIORITY_META[p].label, color: PRIORITY_META[p].color, createDefaults: { priority: p },
        tasks: roots.filter((t) => t.priority === p),
      })), { key: "pNONE", label: "No priority", color: "#9CA3AF", createDefaults: {}, tasks: roots.filter((t) => !t.priority) }];
    case "due":
      return DUE_GROUPS.map((d) => ({ key: `d${d.key}`, label: d.label, color: d.color, createDefaults: {}, tasks: roots.filter((t) => dueBucket(t) === d.key) }));
    case "none":
      return [{ key: "all", label: "All tasks", color: "#047857", createDefaults: {}, tasks: roots }];
  }
}
