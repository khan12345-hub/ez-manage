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

export interface CreateTaskDto {
  name: string;
  groupId: number;
  boardId: number;
}

export const createTask = async (
  name: string,
  groupId: number,
  boardId: number | undefined,
) => {
  const { data } = await api.post(`/boards/${boardId}/tasks`, {
    name,
    groupId,
  });

  return data;
};

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
