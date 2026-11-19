import { api } from "@/lib/api";
import type { WorkPriority } from "@/services/work.api";

/* Accounts & Invoices team chat → tasks (Boards). Kept apart from Company Work's chat API. */

export type BMini = { id: number; firstName: string; lastName: string; avatarUrl: string | null };
export type BChatTask = {
  id: number; name: string; createdAt: string; createdById: number;
  board: { id: number; uid: string; name: string }; group: string; groupId: number; href: string;
  status: { label: string; color: string; category: string | null } | null;
  statuses: { id: number; label: string; color: string; category: string }[];
  priority: { label: string; color: string } | null;
  dueDate: string | null; done: boolean; doneAt: string | null;
  assignees: BMini[]; canResolve: boolean; canEdit: boolean;
};
export type BTarget = { id: number; uid: string; name: string; groups: { id: number; name: string; color: string | null }[]; has: { person: boolean; date: boolean; status: boolean; priority: boolean } };
export type BMention = {
  id: number; at: string; author: BMini; mine: boolean; snippet: string;
  mentioned: { user: BMini; done: boolean }[]; assignee: BMini | null; forMe: boolean; done: boolean; canToggle: boolean;
};
export type BTaskInput = { name: string; assigneeIds?: number[]; dueDate?: string | null; priority?: WorkPriority | null };

const base = (ws: number, ch: number) => `/workspaces/${ws}/chat/channels/${ch}`;

export const boardsChatKeys = {
  tasks: (ch: number) => ["boards", "chat-tasks", ch] as const,
  targets: (ch: number) => ["boards", "chat-task-targets", ch] as const,
  mentions: (ch: number) => ["boards", "chat-mentions", ch] as const,
};

export const boardsChatApi = {
  tasks: async (ws: number, ch: number) => (await api.get<{ tasks: BChatTask[]; people: BMini[]; canCreate: boolean }>(`${base(ws, ch)}/chat-tasks`)).data,
  targets: async (ws: number, ch: number) => (await api.get<{ boards: BTarget[]; default: { boardId: number; groupId: number } | null }>(`${base(ws, ch)}/chat-task-targets`)).data,
  create: async (ws: number, ch: number, body: { boardId?: number; groupId?: number; items: BTaskInput[] }) =>
    (await api.post<{ taskIds: number[]; missing: string[] }>(`${base(ws, ch)}/chat-tasks`, body)).data,
  setDefault: async (ws: number, ch: number, boardId: number | null, groupId: number | null) => (await api.put(`${base(ws, ch)}/chat-task-default`, { boardId, groupId })).data,
  resolve: async (ws: number, ch: number, taskId: number, done: boolean) => (await api.post(`${base(ws, ch)}/chat-tasks/${taskId}/resolve`, { done })).data,
  setStatus: async (ws: number, ch: number, taskId: number, statusId: number) => (await api.post(`${base(ws, ch)}/chat-tasks/${taskId}/status`, { statusId })).data,
  mentions: async (ws: number, ch: number) => (await api.get<BMention[]>(`${base(ws, ch)}/mentions`)).data,
  mentionDone: async (ws: number, messageId: number, done: boolean) => (await api.post(`/workspaces/${ws}/chat/messages/${messageId}/mention-done`, { done })).data,
  /** owners / admins: every channel's name and people (never its messages) */
  manageChannels: async (ws: number) => (await api.get<{ id: number; name: string | null; description: string | null; isDefault: boolean; updatedAt: string; memberCount: number; joined: boolean }[]>(`/workspaces/${ws}/chat/manage-channels`)).data,
  join: async (ws: number, ch: number) => (await api.post(`${base(ws, ch)}/join`)).data,
  addMember: async (ws: number, ch: number, userId: number) => (await api.post(`${base(ws, ch)}/members`, { userId })).data,
  aiSplit: async (ws: number, ch: number, text: string, tz?: string) =>
    (await api.post<{ tasks: { name: string; description: string | null; assigneeIds: number[]; dueDate: string | null; priority: WorkPriority }[] }>(`${base(ws, ch)}/ai-split`, { text, tz })).data,
};

/** chat lines this feature writes (same idea as the existing `__TASK__:` card) */
export function parseChatWork(content: string | null | undefined):
  | { kind: "tasks"; boardId: number; taskIds: number[] }
  | { kind: "resolved"; taskId: number; name: string; done: boolean }
  | { kind: "note"; text: string }
  | null {
  if (!content) return null;
  try {
    if (content.startsWith("__TASKS__:")) { const j = JSON.parse(content.slice(10)); return { kind: "tasks", boardId: Number(j.boardId), taskIds: (j.taskIds ?? []).map(Number) }; }
    if (content.startsWith("__NOTE__:")) { const j = JSON.parse(content.slice(9)); return { kind: "note", text: String(j.text ?? "") }; }
    if (content.startsWith("__RESOLVED__:")) { const j = JSON.parse(content.slice(13)); return { kind: "resolved", taskId: Number(j.taskId), name: String(j.name ?? ""), done: j.done !== false }; }
  } catch { /* not ours */ }
  return null;
}

/** one-line text for previews (sidebar, notifications) */
export function chatWorkPreview(content: string | null | undefined): string | null {
  const p = parseChatWork(content);
  if (!p) return null;
  if (p.kind === "note") return p.text;
  return p.kind === "tasks" ? `📋 ${p.taskIds.length === 1 ? "created a task" : `created ${p.taskIds.length} tasks`}` : `${p.done ? "✅ resolved" : "↺ reopened"} “${p.name}”`;
}
