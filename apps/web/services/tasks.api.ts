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

export interface UpdateTaskDto {
  name?: string;
  groupId?: number;
  order?: number;
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
