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
  groupId: number;
  name: string;
}

export const createTask = async (name: string, groupId: number) => {
  const { data } = await api.post("/tasks", { name, groupId });
  return data;
};
export async function getTask(id: number) {
  const response = await api.get<TaskResponse>(`/tasks/${id}`);
  return response.data;
}

export interface UpdateTaskDto {
  name?: string;
  groupId?: number;
  order?: number;
}

export const updateTask = async (
  taskId: number,
  dto: UpdateTaskDto,
) => {
  const { data } = await api.patch(`/tasks/${taskId}`, dto);
  return data;
};

export async function deleteTask(taskId: number) {
  const { data } = await api.delete(`/tasks/${taskId}`);
  return data;
}

export interface ReorderTaskDto {
  draggedTaskId: number;
  targetTaskId: number;
  destinationGroupId: number | string | null;
}

export async function reorderTask(dto: ReorderTaskDto) {
  const { data } = await api.patch("/tasks/reorder", dto);

  return data;
}
