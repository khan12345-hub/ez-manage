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

export interface FormDesign {
  position: "left" | "center" | "right";
  bgColor: string;
  accentColor: string;
  cardBg: string;
  textColor: string;
  logoUrl?: string | null;
}

export interface BoardForm {
  id: number;
  boardId: number;
  groupId: number;
  shareToken?: string | null;

  title?: string;
  description?: string;

  submitLabel: string;
  isActive: boolean;
  design?: FormDesign | null;

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
  design?: FormDesign;
  fields: BoardFormField[];
}

export interface UpdateBoardFormPayload {
  groupId?: number;
  title?: string;
  description?: string;
  submitLabel?: string;
  isActive?: boolean;
  design?: FormDesign;
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
  shareToken: string | null;

  title: string | null;
  description: string | null;

  submitLabel: string | null;
  isActive: boolean;
  design?: FormDesign | null;

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
  identifier: string | number,
): Promise<PublicBoardForm> => {
  const { data } = await api.get<PublicBoardForm>(
    `/public/form/${identifier}`,
  );

  return data;
};

export const submitBoardForm = async (
  identifier: string | number,
  payload: SubmitBoardFormPayload,
): Promise<SubmitBoardFormResponse> => {
  const { data } = await api.post<SubmitBoardFormResponse>(
    `/public/form/${identifier}/submit`,
    payload,
  );

  return data;
};

export interface PublicFormUploadResponse {
  url: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface PublicFormMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
}

export const getPublicFormMembers = async (
  identifier: string | number,
): Promise<PublicFormMember[]> => {
  const { data } = await api.get<PublicFormMember[]>(
    `/public/form/${identifier}/members`,
  );
  return data;
};

export const uploadPublicFormFile = async (
  identifier: string | number,
  file: File,
): Promise<PublicFormUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<PublicFormUploadResponse>(
    `/public/form/${identifier}/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
};
