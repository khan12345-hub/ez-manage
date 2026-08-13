import { api } from "@/lib/api";

export type BoardColumnType =
  | "STATUS"
  | "TEXT"
  | "PERSON"
  | "DROPDOWN"
  | "DATE"
  | "NUMBER"
  | "FILE"
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

export async function updateColumnAccess(
  boardId: number,
  columnId: number,
  enabled: boolean,
) {
  const { data } = await api.put(
    `/boards/${boardId}/columns/${columnId}/access`,
    {
      enabled,
    },
  );

  return data;
}

export async function updateColumnPermission(
  boardId: number,
  columnId: number,
  userId: number,
  canEdit: boolean,
) {
  const { data } = await api.put(
    `/boards/${boardId}/columns/${columnId}/permissions`,
    {
      userId,
      canEdit,
    },
  );

  return data;
}

export async function removeColumnPermission(
  boardId: number,
  columnId: number,
  userId: number,
) {
  const { data } = await api.delete(
    `/boards/${boardId}/columns/${columnId}/permissions/${userId}`,
  );

  return data;
}