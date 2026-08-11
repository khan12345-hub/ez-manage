import { api } from "@/lib/api";

export interface BoardFormField {
  id?: number;
  columnId: number;
  label: string;
  description?: string;
  position: number;
  required: boolean;
  hidden: boolean;
  column?: any;
}

export interface BoardForm {
  id: number;
  boardId: number;
  groupId: number;

  title?: string;
  description?: string;

  submitLabel: string;
  isActive: boolean;

  fields: BoardFormField[];

  group?: any;
  board?: any;
}

export interface CreateBoardFormPayload {
  groupId: number;
  title?: string;
  description?: string;
  submitLabel?: string;
  isActive?: boolean;
  fields: BoardFormField[];
}

export interface UpdateBoardFormPayload {
  groupId?: number;
  title?: string;
  description?: string;
  submitLabel?: string;
  isActive?: boolean;
  fields?: BoardFormField[];
}

export const createBoardForm = async (
  boardId: number,
  payload: CreateBoardFormPayload,
) => {
  const { data } = await api.post<BoardForm>(
    `/boards/${boardId}/form`,
    payload,
  );

  return data;
};

export const getBoardForm = async (
  boardId: number,
) => {
  const { data } = await api.get<BoardForm>(
    `/boards/${boardId}/form`,
  );

  return data;
};

export const updateBoardForm = async (
  boardId: number,
  payload: UpdateBoardFormPayload,
) => {
  const { data } = await api.patch<BoardForm>(
    `/boards/${boardId}/form`,
    payload,
  );

  return data;
};

export const deleteBoardForm = async (
  boardId: number,
) => {
  const { data } = await api.delete(
    `/boards/${boardId}/form`,
  );

  return data;
};