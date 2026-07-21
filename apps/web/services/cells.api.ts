import { api } from "@/lib/api";

export interface UpdateCellDto {
  value: any;
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