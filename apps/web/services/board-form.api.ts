import { api } from "@/lib/api";

export interface BoardFormStatusOption {
  id?: number | string;
  label: string;
  color: string;
}

export interface BoardFormField {
  id?: number;
  columnId: number;
  label: string;
  description?: string;
  position: number;
  required: boolean;
  hidden: boolean;
  statusOptions?: BoardFormStatusOption[];

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

export const getBoardForm = async (boardId: number) => {
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

export const deleteBoardForm = async (boardId: number) => {
  const { data } = await api.delete(
    `/boards/${boardId}/form`,
  );

  return data;
};

export interface PublicBoardFormField {
  id: number;
  columnId: number;
  label: string | null;
  description: string | null;
  position: number;
  required: boolean;
  hidden: boolean;

  column: {
    id: number;
    name: string;
    type: string;
    isPrimary?: boolean;

    statusOptions?: {
      id: number;
      label: string;
      value: string;
      color: string;
    }[];
  };
}

export interface PublicBoardForm {
  id: number;
  boardId: number;
  groupId: number;

  title: string | null;
  description: string | null;

  submitLabel: string | null;
  isActive: boolean;

  fields: PublicBoardFormField[];
}

export interface SubmitBoardFormValue {
  columnId: number;
  /**
   * The value for this column. Shape depends on column type:
   * - TEXT     → string
   * - NUMBER   → number
   * - CHECKBOX → boolean
   * - DATE     → ISO date string (YYYY-MM-DD)
   * - TIMELINE → { startDate: string; endDate: string }
   * - STATUS   → the StatusOption label string (backend resolves to {label, color})
   */
  value: unknown;
}

export interface SubmitBoardFormPayload {
  values: SubmitBoardFormValue[];
  /** Optional task name override. Defaults to "Form submission" on the server. */
  taskName?: string;
}

export interface SubmitBoardFormResponse {
  taskId: number;
  message?: string;
}

export const getPublicBoardForm = async (
  boardId: number,
): Promise<PublicBoardForm> => {
  const { data } = await api.get<PublicBoardForm>(
    `/public/form/${boardId}`,
  );

  return data;
};

export const submitBoardForm = async (
  boardId: number,
  payload: SubmitBoardFormPayload,
): Promise<SubmitBoardFormResponse> => {
  const { data } = await api.post<SubmitBoardFormResponse>(
    `/public/form/${boardId}/submit`,
    payload,
  );

  return data;
};
