import { api } from "@/lib/api";


export interface BoardFormField {
  id?: number;
  columnId: number;
  label?: string;
  description?: string;
  position: number;
  required: boolean;
  hidden: boolean;

  column?: {
    id: number;
    name: string;
    type: string;
  };
}

export interface BoardForm {
  id: number;
  viewId: number;
  groupId: number;
  title: string | null;
  description: string | null;
  submitLabel: string | null;
  isActive: boolean;
  fields: BoardFormField[];

  group?: {
    id: number;
    name: string;
  };
}

export interface CreateBoardFormPayload {
  groupId: number;
  title?: string;
  description?: string;
  submitLabel?: string;
  isActive?: boolean;
  fields: BoardFormField[];
}

export async function getBoardForm(
  boardId: number,
  viewId: number,
) {
  const { data } = await api.get<BoardForm>(
    `/boards/${boardId}/views/${viewId}/form`,
  );

  return data;
}

export async function createBoardForm(
  boardId: number,
  viewId: number,
  payload: CreateBoardFormPayload,
) {
  const { data } = await api.post<BoardForm>(
    `/boards/${boardId}/views/${viewId}/form`,
    payload,
  );

  return data;
}

export async function updateBoardForm(
  boardId: number,
  viewId: number,
  payload: Partial<CreateBoardFormPayload>,
) {
  const { data } = await api.patch<BoardForm>(
    `/boards/${boardId}/views/${viewId}/form`,
    payload,
  );

  return data;
}

export async function deleteBoardForm(
  boardId: number,
  viewId: number,
) {
  const { data } = await api.delete(
    `/boards/${boardId}/views/${viewId}/form`,
  );

  return data;
}