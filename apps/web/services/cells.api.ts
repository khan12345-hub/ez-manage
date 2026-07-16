import { api } from "@/lib/api";

export interface UpdateCellDto {
  value: any;
}

export const updateCell = async (
  cellId: number,
  dto: UpdateCellDto,
) => {
  const { data } = await api.patch(`/cells/${cellId}`, dto);
  return data;
};