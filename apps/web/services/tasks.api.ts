import { api } from "@/lib/api";

export interface GetSingleTaskDto {
  groupId: number;
}

export interface TaskCellResponse {
  id: number;
  taskId: number;
  columnId: number;
  value: any;
  column: {
    id: number;
    name: string;
    type: string;
    order: number;
  };
}

export interface TaskResponse {
  id: number;
  title: string;
  groupId: number;
  order: number;
  createdAt: string;
  updatedAt: string;
  name:string;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };

  group: {
    id: number;
    name: string;
    boardId: number;
  };

  cells: TaskCellResponse[];
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceEndDate: string | null;
  sourceTaskId: number | null;
}



export interface CreateTaskPayload {
  name: string;
  groupId: number;
  parentId?: number | null;
}

export async function createTask(
  payload: CreateTaskPayload,
  boardId: number | undefined,
  parentId?: number | null,
) {
  const { data } = await api.post(
    `/boards/${boardId}/tasks`,
    payload,
  );

  return data;
}

export async function getTask(taskId: number, boardId: number) {
  const response = await api.get<TaskResponse>(
    `/boards/${boardId}/tasks/${taskId}`,
  );

  return response.data;
}

export type RecurrenceType = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface UpdateTaskDto {
  name?: string;
  groupId?: number;
  order?: number;
  recurrenceType?: RecurrenceType;
  recurrenceInterval?: number;
  recurrenceEndDate?: string | null;
}

export const updateTask = async (
  boardId: number | undefined,
  taskId: number,
  dto: UpdateTaskDto,
) => {
  const { data } = await api.patch(`/boards/${boardId}/tasks/${taskId}`, dto);

  return data;
};

export async function deleteTask(taskId: number, boardId: number) {
  const { data } = await api.delete(`/boards/${boardId}/tasks/${taskId}`);

  return data;
}
export interface ReorderTaskDto {
  taskId: number;
  destinationGroupId: number;
  previousTaskId?: number | null;
  nextTaskId?: number | null;
}

export async function reorderTask(boardId: number, dto: ReorderTaskDto) {
  const { data } = await api.patch(`/boards/${boardId}/tasks/reorder`, dto);

  return data;
}

export async function uploadTaskCellFiles(
  boardId: number | undefined,
  cellId: number,
  files: File[],
) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await api.post(
    `/boards/${boardId}/cells/${cellId}/files`,
    formData,
  );

  return response.data;
}
export const deleteTaskCellFile = async (
  boardId: number | undefined,
  cellId: number,
  fileId: number,
) => {
  const response = await api.delete(
    `/boards/${boardId}/cells/${cellId}/files/${fileId}`,
  );

  return response.data;
};

export async function getTaskFiles(
  taskId: number,
) {
  const { data } = await api.get(
    `/tasks/${taskId}/files`,
  );

  return data;
}

export interface ReorderSubtaskDto {
  previousTaskId: number | null;
  nextTaskId: number | null;
}

export async function reorderSubtask(
  boardId: number | undefined,
  taskId: number,
  data: ReorderSubtaskDto,
) {
  const response = await api.patch(
    `/boards/${boardId}/tasks/${taskId}/reorder-subtask`,
    data,
  );

  return response.data;
}

export async function bulkDeleteTasks(
  boardId: number,
  taskIds: number[],
) {
  const { data } = await api.post(
    `/boards/${boardId}/tasks/bulk/delete`,
    {
      taskIds,
    },
  );

  return data;
}

export interface BulkUpdateTaskPayload {
  taskIds: number[];
  columnId: number;
  value: any;
}

export async function bulkUpdateTasks(
  boardId: number,
  payload: BulkUpdateTaskPayload,
) {
  const { data } = await api.post(
    `/boards/${boardId}/tasks/bulk/update`,
    payload,
  );

  return data;
}

export async function bulkMoveTasks(
  boardId: number,
  taskIds: number[],
  targetGroupId: number,
) {
  const { data } = await api.post(`/boards/${boardId}/tasks/bulk/move`, {
    taskIds,
    targetGroupId,
  });
  return data;
}

export async function bulkDuplicateTasks(
  boardId: number,
  taskIds: number[],
  withUpdates: boolean,
) {
  const { data } = await api.post(`/boards/${boardId}/tasks/bulk/duplicate`, {
    taskIds,
    withUpdates,
  });
  return data;
}

export interface AssignedTask {
  id: number;
  name: string;
  dueDate: string | null;
  statusLabel: string | null;
  statusColor: string | null;
  statusCellId: number | null;
  dateCellId: number | null;
  personCellId: number | null;
  statusOptions: { id: string; label: string; color: string }[];
  assignedUsers: { id: number; firstName: string; lastName: string; avatarUrl: string | null }[];
  createdAt: string;
  createdBy: { id: number; firstName: string; lastName: string; avatarUrl: string | null };
  boardId: number;
  boardName: string;
  groupName: string;
}

export async function getMemberTasks(
  workspaceId: number,
  userId: number,
): Promise<AssignedTask[]> {
  const { data } = await api.get(
    `/workspaces/${workspaceId}/members/${userId}/tasks`,
  );
  return data;
}

export interface ActivityItem {
  kind: "comment" | "log";
  id: number;
  createdAt: string;
  // log-only
  action?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  // comment-only
  content?: any;
  mentions?: { user: { id: number; firstName: string; lastName: string; avatarUrl: string | null } }[];
  reactions?: { emoji: string; userId: number }[];
  // shared
  task: {
    id: number;
    name: string;
    group: { name: string; board: { id: number; name: string } };
  } | null;
}

export async function getMemberActivity(
  workspaceId: number,
  userId: number,
): Promise<ActivityItem[]> {
  const { data } = await api.get(
    `/workspaces/${workspaceId}/members/${userId}/activity`,
  );
  return data;
}

export async function updateTaskCell(
  boardId: number,
  cellId: number,
  value: any,
) {
  const { data } = await api.patch(`/boards/${boardId}/cells/${cellId}`, { value });
  return data;
}

export async function getGroupTasks(
  boardId: number,
  groupId: number,
  search?: string,
  person?: string,
) {
  const params = new URLSearchParams();

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  if (person?.trim()) {
    params.set("person", person.trim());
  }

  const { data } = await api.get(
    `/boards/${boardId}/groups/${groupId}/tasks`,
    {
      params,
    },
  );

  return data;
}