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
  assignees: WorkUser[];
  subtaskCount: number;
  commentCount: number;
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
}

export interface WorkComment {
  id: number;
  taskId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: WorkUser;
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
}

/* ─── calls ────────────────────────────────────────────────────────────── */

const get = async <T,>(url: string) => (await api.get<T>(url)).data;
const post = async <T,>(url: string, body?: unknown) => (await api.post<T>(url, body)).data;
const patch = async <T,>(url: string, body?: unknown) => (await api.patch<T>(url, body)).data;
const put = async <T,>(url: string, body?: unknown) => (await api.put<T>(url, body)).data;
const del = async <T,>(url: string) => (await api.delete<T>(url)).data;

export const workApi = {
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
  addComment: (taskId: number, content: string, parentId?: number) =>
    post<WorkComment>(`/work/tasks/${taskId}/comments`, { content, ...(parentId ? { parentId } : {}) }),
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
