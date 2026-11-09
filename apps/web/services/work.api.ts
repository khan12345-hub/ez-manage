import { api } from "@/lib/api";

/* ─── types (mirror apps/api/src/work) ─────────────────────────────────── */

export type StatusCategory = "NOT_STARTED" | "ACTIVE" | "DONE";
export type WorkPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";

export interface WorkUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
}

export interface WorkStatus {
  id: number;
  name: string;
  color: string;
  category: StatusCategory;
  order: number;
  spaceId: number | null;
  folderId: number | null;
  listId: number | null;
}

export interface WorkListNode {
  id: number;
  uid: string;
  name: string;
  color: string | null;
  order: number;
  folderId: number | null;
  openTaskCount: number;
}

export interface WorkFolderNode {
  id: number;
  uid: string;
  name: string;
  order: number;
  lists: WorkListNode[];
}

export interface WorkSpaceNode {
  id: number;
  uid: string;
  name: string;
  color: string;
  icon: string | null;
  isPrivate: boolean;
  order: number;
  folders: WorkFolderNode[];
  lists: WorkListNode[];
}

export interface WorkAccessFlags {
  canEdit: boolean;
  canManage: boolean;
}

export interface WorkTree {
  access: WorkAccessFlags;
  spaces: WorkSpaceNode[];
}

export interface WorkTask {
  id: number;
  uid: string;
  listId: number;
  statusId: number | null;
  parentId: number | null;
  name: string;
  priority: WorkPriority | null;
  startDate: string | null;
  dueDate: string | null;
  order: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: number;
  timeEstimate: number | null;
  assignees: WorkUser[];
  tags: WorkTag[];
  subtaskCount: number;
  commentCount: number;
}

export interface WorkTag {
  id: number;
  name: string;
  color: string;
}

export interface WorkChecklistItem {
  id: number;
  name: string;
  done: boolean;
  order: number;
  assignee: WorkUser | null;
}

export interface WorkChecklist {
  id: number;
  name: string;
  order: number;
  items: WorkChecklistItem[];
}

export interface WorkLinkedTask {
  linkId: number;
  task: {
    id: number;
    uid: string;
    name: string;
    completedAt: string | null;
    status: { name: string; color: string; category: StatusCategory } | null;
    list: { name: string };
  };
}

export interface WorkTimeEntry {
  id: number;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  seconds: number;
  running: boolean;
  note: string | null;
  billable: boolean;
  user: WorkUser;
}

export interface WorkActivity {
  id: number;
  action: string;
  fromValue: unknown;
  toValue: unknown;
  createdAt: string;
  user: WorkUser;
}

export interface WorkListDetail {
  id: number;
  uid: string;
  name: string;
  description: string | null;
  color: string | null;
  spaceId: number;
  folderId: number | null;
  space: { id: number; uid: string; name: string; color: string; workspaceId: number; workspace: { uid: string; name: string } };
  folder: { id: number; uid: string; name: string } | null;
  statuses: WorkStatus[];
  members: WorkUser[];
  access: WorkAccessFlags;
}

export interface WorkTaskDetail extends WorkTask {
  description: string | null;
  createdBy: WorkUser;
  parent: { id: number; uid: string; name: string } | null;
  list: { id: number; uid: string; name: string; spaceId: number; folderId: number | null; space: { name: string; uid: string } };
  subtasks: WorkTask[];
  statuses: WorkStatus[];
  access: WorkAccessFlags;
  checklists: WorkChecklist[];
  links: { waitingOn: WorkLinkedTask[]; blocking: WorkLinkedTask[]; linked: WorkLinkedTask[] };
  time: { totalSeconds: number; myRunning: { id: number; startedAt: string } | null };
}

export interface WorkComment {
  id: number;
  taskId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  user: WorkUser;
  assignee: WorkUser | null;
  attachments?: WorkAttachment[];
}

export interface WorkAttachment {
  id: number;
  source: "task" | "comment" | "description";
  commentId: number | null;
  createdAt: string;
  uploadedBy: WorkUser;
  file: { id: number; fileName: string; mimeType: string; fileSize: number; url: string };
}

export interface WorkWebLink {
  id: number;
  url: string;
  title: string | null;
  createdAt: string;
  createdBy: WorkUser;
}

export type InboxTab = "primary" | "later" | "cleared";
export interface InboxItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: number | null;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
  clearedAt: string | null;
  snoozedUntil: string | null;
}

export interface MyWorkTask extends WorkTask {
  status: { id: number; name: string; color: string; category: StatusCategory } | null;
  list: { id: number; uid: string; name: string; space: { name: string; color: string } };
}

export interface TaskInput {
  name?: string;
  statusId?: number | null;
  parentId?: number;
  priority?: WorkPriority | null;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeIds?: number[];
  description?: string | null;
  listId?: number;
  order?: number;
  timeEstimate?: number | null;
  tagIds?: number[];
}

/* ─── calls ────────────────────────────────────────────────────────────── */

const get = async <T,>(url: string) => (await api.get<T>(url)).data;
const post = async <T,>(url: string, body?: unknown) => (await api.post<T>(url, body)).data;
const patch = async <T,>(url: string, body?: unknown) => (await api.patch<T>(url, body)).data;
const put = async <T,>(url: string, body?: unknown) => (await api.put<T>(url, body)).data;
const del = async <T,>(url: string) => (await api.delete<T>(url)).data;

export type WorkRole = "OWNER" | "ADMIN" | "MEMBER" | "LIMITED_MEMBER" | "GUEST";
export const WORK_ROLE_META: Record<WorkRole, { label: string; hint: string }> = {
  OWNER: { label: "Owner", hint: "Full control of Work in this workspace." },
  ADMIN: { label: "Admin", hint: "Can manage spaces, people and Work settings." },
  MEMBER: { label: "Member", hint: "Can access all public spaces in Work." },
  LIMITED_MEMBER: { label: "Limited Member", hint: "Can only access spaces shared with them." },
  GUEST: { label: "Guest", hint: "View only. Can only see spaces shared with them." },
};
export interface WorkPeople {
  me: { role: WorkRole | null; canManage: boolean };
  members: { role: WorkRole; createdAt: string; user: WorkUser }[];
  invites: { id: number; email: string; workRole: WorkRole | null; createdAt: string; expiresAt: string }[];
}
export type InviteResult = { email: string; status: "added" | "invited" | "already_member" | "already_invited" };

export const workApi = {
  myWorkspaces: () => get<{ id: number; uid: string; name: string; role: WorkRole }[]>(`/work/my-workspaces`),
  people: (workspace: string | number) => get<WorkPeople>(`/work/workspaces/${workspace}/people`),
  invite: (workspace: string | number, emails: string[], role: Exclude<WorkRole, "OWNER">) =>
    post<{ results: InviteResult[] }>(`/work/workspaces/${workspace}/invites`, { emails, role }),
  changeRole: (workspace: string | number, userId: number, role: Exclude<WorkRole, "OWNER">) => patch(`/work/workspaces/${workspace}/people/${userId}`, { role }),
  removePerson: (workspace: string | number, userId: number) => del(`/work/workspaces/${workspace}/people/${userId}`),
  revokeInvite: (id: number) => del(`/work/invites/${id}`),
  spaceMembers: (spaceId: number) => get<{ userIds: number[] }>(`/work/spaces/${spaceId}/members`),

  tree: (workspace: string | number) => get<WorkTree>(`/work/workspaces/${workspace}/tree`),
  myTasks: (workspace: string | number) => get<MyWorkTask[]>(`/work/workspaces/${workspace}/my-tasks`),

  createSpace: (workspace: string | number, body: { name: string; color?: string; isPrivate?: boolean }) =>
    post<WorkSpaceNode>(`/work/workspaces/${workspace}/spaces`, body),
  updateSpace: (id: number, body: Partial<{ name: string; color: string; isPrivate: boolean; order: number }>) =>
    patch(`/work/spaces/${id}`, body),
  archiveSpace: (id: number) => del(`/work/spaces/${id}`),
  setSpaceMembers: (id: number, userIds: number[]) => put(`/work/spaces/${id}/members`, { userIds }),

  createStatus: (spaceId: number, body: { name: string; color: string; category?: StatusCategory }) =>
    post<WorkStatus>(`/work/spaces/${spaceId}/statuses`, body),
  updateStatus: (id: number, body: Partial<{ name: string; color: string; category: StatusCategory; order: number }>) =>
    patch<WorkStatus>(`/work/statuses/${id}`, body),
  deleteStatus: (id: number) => del(`/work/statuses/${id}`),

  createFolder: (spaceId: number, name: string) => post<WorkFolderNode>(`/work/spaces/${spaceId}/folders`, { name }),
  updateFolder: (id: number, body: Partial<{ name: string; order: number }>) => patch(`/work/folders/${id}`, body),
  archiveFolder: (id: number) => del(`/work/folders/${id}`),

  createList: (spaceId: number, body: { name: string; folderId?: number; color?: string }) =>
    post<WorkListNode>(`/work/spaces/${spaceId}/lists`, body),
  getList: (uid: string) => get<WorkListDetail>(`/work/lists/${uid}`),
  updateList: (id: number, body: Partial<{ name: string; color: string | null; description: string | null; folderId: number | null; order: number }>) =>
    patch(`/work/lists/${id}`, body),
  archiveList: (id: number) => del(`/work/lists/${id}`),

  listTasks: (listId: number) => get<WorkTask[]>(`/work/lists/${listId}/tasks`),
  createTask: (listId: number, body: TaskInput & { name: string }) => post<WorkTask>(`/work/lists/${listId}/tasks`, body),
  getTask: (uid: string) => get<WorkTaskDetail>(`/work/tasks/${uid}`),
  updateTask: (id: number, body: TaskInput) => patch<WorkTask>(`/work/tasks/${id}`, body),
  archiveTask: (id: number) => del(`/work/tasks/${id}`),

  comments: (taskId: number) => get<WorkComment[]>(`/work/tasks/${taskId}/comments`),
  addComment: (taskId: number, content: string, opts?: { parentId?: number; assigneeId?: number; attachmentIds?: number[]; mentionIds?: number[] }) =>
    post<WorkComment>(`/work/tasks/${taskId}/comments`, { content, ...(opts?.parentId ? { parentId: opts.parentId } : {}), ...(opts?.assigneeId ? { assigneeId: opts.assigneeId } : {}), ...(opts?.attachmentIds?.length ? { attachmentIds: opts.attachmentIds } : {}), ...(opts?.mentionIds?.length ? { mentionIds: opts.mentionIds } : {}) }),
  resolveComment: (id: number) => post<WorkComment>(`/work/comments/${id}/resolve`),
  reopenComment: (id: number) => post<WorkComment>(`/work/comments/${id}/reopen`),
  assignedComments: (workspace: string | number, mode: "to-me" | "by-me", resolved = false) =>
    get<any[]>(`/work/workspaces/${workspace}/assigned-comments?mode=${mode}&resolved=${resolved}`),
  activity: (taskId: number) => get<WorkActivity[]>(`/work/tasks/${taskId}/activity`),

  attachments: (taskId: number) => get<WorkAttachment[]>(`/work/tasks/${taskId}/attachments`),
  uploadAttachments: (taskId: number, files: File[], source: WorkAttachment["source"] = "task") => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return post<WorkAttachment[]>(`/work/tasks/${taskId}/attachments?source=${source}`, fd);
  },
  deleteAttachment: (id: number) => del(`/work/attachments/${id}`),
  webLinks: (taskId: number) => get<WorkWebLink[]>(`/work/tasks/${taskId}/web-links`),
  addWebLink: (taskId: number, url: string, title?: string) => post<WorkWebLink>(`/work/tasks/${taskId}/web-links`, { url, ...(title ? { title } : {}) }),
  deleteWebLink: (id: number) => del(`/work/web-links/${id}`),

  inbox: (tab: InboxTab, opts: { unread?: boolean; product?: string } = {}) =>
    get<{ items: InboxItem[]; counts: { primaryUnread: number; later: number; cleared: number } }>(
      `/notifications/inbox?tab=${tab}&product=work${opts.unread ? "&unread=true" : ""}`,
    ),
  inboxAction: (id: string, action: "clear" | "unclear" | "snooze" | "unsnooze" | "read" | "unread", until?: string) =>
    patch(`/notifications/${id}/inbox`, { action, ...(until ? { until } : {}) }),
  inboxClearAll: () => patch(`/notifications/inbox/clear-all?product=work`),

  tags: (spaceId: number) => get<WorkTag[]>(`/work/spaces/${spaceId}/tags`),
  createTag: (spaceId: number, name: string, color: string) => post<WorkTag>(`/work/spaces/${spaceId}/tags`, { name, color }),
  deleteTag: (id: number) => del(`/work/tags/${id}`),

  createChecklist: (taskId: number, name: string) => post<WorkChecklist>(`/work/tasks/${taskId}/checklists`, { name }),
  updateChecklist: (id: number, body: Partial<{ name: string; order: number }>) => patch(`/work/checklists/${id}`, body),
  deleteChecklist: (id: number) => del(`/work/checklists/${id}`),
  addChecklistItem: (checklistId: number, name: string, assigneeId?: number) =>
    post<WorkChecklistItem>(`/work/checklists/${checklistId}/items`, { name, ...(assigneeId ? { assigneeId } : {}) }),
  updateChecklistItem: (id: number, body: Partial<{ name: string; done: boolean; assigneeId: number | null; order: number }>) =>
    patch<WorkChecklistItem>(`/work/checklist-items/${id}`, body),
  deleteChecklistItem: (id: number) => del(`/work/checklist-items/${id}`),

  addLink: (taskId: number, otherTaskId: number, type: "WAITING_ON" | "BLOCKING" | "LINKED") =>
    post(`/work/tasks/${taskId}/links`, { taskId: otherTaskId, type }),
  removeLink: (linkId: number) => del(`/work/links/${linkId}`),

  time: (taskId: number) => get<{ totalSeconds: number; entries: WorkTimeEntry[] }>(`/work/tasks/${taskId}/time`),
  startTimer: (taskId: number) => post(`/work/tasks/${taskId}/time/start`),
  stopTimer: () => post(`/work/time/stop`),
  runningTimer: () => get<{ id: number; startedAt: string; task: { id: number; uid: string; name: string; list: { uid: string; space: { workspaceId: number; workspace: { uid: string } } } } } | null>(`/work/time/running`),
  addTime: (taskId: number, body: { startedAt: string; duration: number; note?: string }) => post(`/work/tasks/${taskId}/time`, body),
  deleteTime: (id: number) => del(`/work/time/${id}`),
  editComment: (id: number, content: string) => patch<WorkComment>(`/work/comments/${id}`, { content }),
  deleteComment: (id: number) => del(`/work/comments/${id}`),
};

/* ─── shared helpers ───────────────────────────────────────────────────── */

export const workKeys = {
  tree: (ws: string) => ["work", "tree", ws] as const,
  list: (uid: string) => ["work", "list", uid] as const,
  tasks: (listId: number) => ["work", "tasks", listId] as const,
  task: (uid: string) => ["work", "task", uid] as const,
  comments: (taskId: number) => ["work", "comments", taskId] as const,
  my: (ws: string) => ["work", "my", ws] as const,
};

export const PRIORITY_META: Record<WorkPriority, { label: string; color: string; rank: number }> = {
  URGENT: { label: "Urgent", color: "#DC2626", rank: 0 },
  HIGH: { label: "High", color: "#D97706", rank: 1 },
  NORMAL: { label: "Normal", color: "#2563EB", rank: 2 },
  LOW: { label: "Low", color: "#9CA3AF", rank: 3 },
};

export const userName = (u: Pick<WorkUser, "firstName" | "lastName">) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
export const initials = (u: Pick<WorkUser, "firstName" | "lastName">) =>
  `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";

/** Calendar day (local) of an ISO date. */
export function dayOf(iso: string) {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isTaskOverdue(t: Pick<WorkTask, "dueDate" | "completedAt">) {
  if (!t.dueDate || t.completedAt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dayOf(t.dueDate) < today;
}

/** 5400 -> "1h 30m", 45 -> "45s" */
export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  if (m) return `${m}m`;
  return `${Math.max(0, Math.round(totalSeconds))}s`;
}

/** minutes -> "1h 30m" */
export const formatMinutes = (min: number) => formatDuration(min * 60);

/** "1h 30m" | "90m" | "1.5h" | "90" (minutes) -> minutes, or null if unparseable */
export function parseEstimate(input: string): number | null {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  let total = 0;
  let matched = false;
  for (const [, n, unit] of v.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)/g)) {
    matched = true;
    total += unit!.startsWith("h") ? Number(n) * 60 : Number(n);
  }
  return matched ? Math.round(total) : null;
}
