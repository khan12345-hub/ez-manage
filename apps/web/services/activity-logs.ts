import { api } from "@/lib/api";

export interface ActivityUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}
export interface TaskActivity {
  id: number;
  boardId: number;
  taskId: number | null;
  groupId: number | null;
  userId: number;
  entityType:
    | "BOARD"
    | "GROUP"
    | "TASK"
    | "COLUMN"
    | "TASK_CELL"
    | "FILE"
    | "COMMENT"
    | "REPLY"
    | "MEMBER";
  entityId: number;
  action:
    | "CREATED"
    | "UPDATED"
    | "DELETED"
    | "RESTORED"
    | "MOVED"
    | "REORDERED"
    | "ASSIGNED"
    | "UNASSIGNED"
    | "STATUS_CHANGED"
    | "FILE_ADDED"
    | "FILE_DELETED"
    | "COMMENT_ADDED"
    | "COMMENT_UPDATED"
    | "COMMENT_DELETED"
    | "REPLY_ADDED"
    | "MEMBER_ADDED"
    | "MEMBER_REMOVED";
  metadata: {
    columnId?: number;
    columnName?: string;
    columnType?: string;
    oldValue?: unknown;
    newValue?: unknown;
    oldLabel?: string | null;
    newLabel?: string | null;
    taskName?: string;
    [key: string]: unknown;
  } | null;
  undoneAt: string | null;
  undoneById: number | null;
  createdAt: string;
  user: ActivityUser;
  task?: { id: number; name: string } | null;
  group?: { id: number; name: string } | null;
}
export interface TaskActivitiesResponse {
  data: TaskActivity[];
  meta: { limit: number; nextCursor: string | null; hasNextPage: boolean };
}

export async function getTaskActivities(
  taskId: number,
  cursor?: string,
  limit = 20,
) {
  const response = await api.get<TaskActivitiesResponse>(
    `/tasks/${taskId}/activity`,
    { params: { cursor, limit } },
  );
  return response.data;
}
