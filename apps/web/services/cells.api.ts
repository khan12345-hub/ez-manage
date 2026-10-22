import { api } from "@/lib/api";

export interface UpdateCellDto {
  value: any;
  /** ISO-8601 timestamp; triggers optimistic-concurrency check on the server (HTTP 409 on mismatch). */
  updatedAt?: string;
}

export const updateCell = async (
  boardId: number | undefined,
  cellId: number,
  dto: UpdateCellDto,
) => {
  const { data } = await api.patch(
    `/boards/${boardId}/cells/${cellId}`,
    dto,
  );

  return data;
};

export const createCell = async (
  boardId: number,
  taskId: number,
  columnId: number,
): Promise<{ id: number; taskId: number; columnId: number }> => {
  const { data } = await api.post(`/boards/${boardId}/cells`, {
    taskId,
    columnId,
  });
  return data;
};

