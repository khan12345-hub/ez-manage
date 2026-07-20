import { api } from "@/lib/api";

export type BoardColumnType =
  // TEXT = "TEXT",
  // NUMBER = "NUMBER",
  // DATE = "DATE",
  // STATUS = "STATUS",
  // PERSON = "PERSON",
  // CHECKBOX = "CHECKBOX",
  // DROPDOWN = "DROPDOWN",
  // LABEL = "LABEL",
  | "STATUS"
  | "TEXT"
  | "PERSON"
  | "DROPDOWN"
  | "DATE"
  | "NUMBER"
  | "FILES"
  | "TIMELINE"
  | "CHECKBOX";

export const createColumn = async (boardId: number, type: BoardColumnType) => {
  const { data } = await api.post("/columns", {
    boardId,
    type,
  });

  return data;
};

export const updateColumn = async (id: number, name: string) => {
  const { data } = await api.patch(`/columns/${id}`, {
    name,
  });

  return data;
};

export const deleteColumn = async (id: number) => {
  await api.delete(`/columns/${id}`);
};

export interface ReorderColumnDto {
  boardId: number;
  columnId:number;
  previousColumnId: number;
  nextColumnId: number;
}

export const reorderColumn = async (data: ReorderColumnDto) => {
  const { data: resData } = await api.patch("/columns/reorder", data);
  return resData;
};
