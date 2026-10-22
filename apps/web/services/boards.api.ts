import { api } from "@/lib/api";
import { BoardColumnType } from "./columns.api";

export type BoardDetail = {
  id: number;
  uid: string;
  name: string;
  workspaceId: number;
  createdAt: string;
  updatedAt: string;
  visibility: "PUBLIC" | "PRIVATE";
  createdById: number;
  budgetHours: number | null;
  columns: Array<{
    id: number;
    name: string;
    type: string;
    order: number;
    width: number;
    settings: unknown;
    boardId: string | number;
    createdAt: string;
    updatedAt: string;
  }>;
  members: Array<{
    id: number;
    boardId: string | number;
    userId: number;
    createdAt: string;
    user: {
      id: number;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  }>;
  groups: Array<{
    id: number;
    name: string;
    color: string;
    order: number;
    boardId: string | number;
    createdAt: string;
    updatedAt: string;
    createdById: number;
    tasks: Array<{
      id: number;
      groupId: number;
      order: number;
      createdById: number;
      createdAt: string;
      updatedAt: string;
      cells: Array<{
        id: number;
        taskId: number;
        columnId: number;
        value: Record<string, unknown>;
        column: {
          id: number;
          name: string;
          type: string;
          order: number;
        };
      }>;
    }>;
  }>;
};

export async function getBoards(workspaceId: string | number | undefined) {
  const response = await api.get(`/workspaces/${workspaceId}/boards`);
  return response.data;
}

export interface RecentBoard {
  id: number;
  uid: string;
  name: string;
  viewedAt: string;
}

export async function getRecentlyViewedBoards(workspaceId: string | number): Promise<RecentBoard[]> {
  const { data } = await api.get<RecentBoard[]>('/boards/recently-viewed', {
    params: { workspaceId },
  });
  return data;
}

export interface BoardGroup {
  id: number;
  name: string;
  color: string;
}

export async function getBoardGroups(boardId: string | number): Promise<BoardGroup[]> {
  const response = await api.get<BoardGroup[]>(`/boards/${boardId}/group-list`);
  return response.data;
}

export async function getBoardDetail(
  boardId: string | number,
  search?: string,
  person?: string,
) {
  const response = await api.get(
    `/boards/${boardId}`,
    {
      params: {
        search: search || undefined,
        person: person || undefined,
      },
    },
  );

  return response.data;
}



export type CreateBoardDto = {
  name: string;
  workspaceId: number;
  visibility?: "PUBLIC" | "PRIVATE";
  templateId?: number;
};

export async function createBoard(data: CreateBoardDto) {
  const response = await api.post("/boards", data);
  return response.data;
}

export type UpdateBoardDto = Partial<CreateBoardDto> & { budgetHours?: number | null };

export async function updateBoard(boardId: string | number, data: UpdateBoardDto) {
  const response = await api.patch(`/boards/${boardId}`, data);
  return response.data;
}

export async function deleteBoard(boardId: string | number) {
  const response = await api.delete(`/boards/${boardId}`);
  return response.data;
}

export async function exportBoard(boardId: string | number, boardName: string) {
  const response = await api.get(`/boards/${boardId}/export`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${boardName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'board'}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface BoardMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

export async function getBoardMembers(
  boardId: string | number | undefined,
  search = ""
): Promise<BoardMember[]> {
  const { data } = await api.get(`/boards/${boardId}/members`, {
    params: {
      search,
    },
  });

  return data;
}

export const searchBoardTasks = async ({
  boardId,
  query,
}: {
  boardId: string | number;
  query: string;
}) => {
  const { data } = await api.get(
    `/boards/${boardId}/search`,
    {
      params: {
        q: query,
      },
    },
  );

  return data;
};

export interface ExcelColumnMappingDto {
  sourceColumn: string;
  targetColumn: string;
  type: string;
}

export interface ImportedComment {
  itemId: string;
  contentType: "Update" | "Reply";
  user: string;
  createdAt: string;
  content: string;
  assetIds: string[];
  postId: string;
  parentPostId: string;
}

export interface ImportExcelBoardDto {
  boardName: string;
  visibility: "PUBLIC" | "PRIVATE";
  workspaceId: number;
  taskColumn: string;
  groupColumn?: string;
  columns: ExcelColumnMappingDto[];
  rows: Record<string, unknown>[];
  comments?: ImportedComment[];
}

export interface ImportSkippedItem {
  rowIndex: number;
  taskName?: string;
  column?: string;
  reason: string;
}

export interface ImportExcelBoardResponse {
  jobId: number;
}

export interface ImportJobSummary {
  tasksCreated: number;
  commentsCreated: number;
  timeEntriesCreated: number;
  usersCreated: number;
  filesQueued: number;
  skipped: number;
}

export interface ImportJobStatus {
  id: number;
  boardName: string;
  status: "processing" | "done" | "failed";
  totalRows: number;
  boardId?: number | null;
  error?: string | null;
  summary?: ImportJobSummary | null;
}

export const importExcelBoard = async (
  dto: ImportExcelBoardDto,
): Promise<ImportExcelBoardResponse> => {
  const { data } = await api.post<ImportExcelBoardResponse>(
    "/boards/import/excel",
    dto,
  );

  return data;
};

export const getImportJob = async (jobId: number): Promise<ImportJobStatus> => {
  const { data } = await api.get<ImportJobStatus>(`/boards/import-jobs/${jobId}`);
  return data;
};

export interface ExcelColumnMappingDto {
  sourceColumn: string;
  targetColumn: string;
  type: string;
}

export interface Group {
  id: number;
  name: string;
  order: number;
  boardId: string | number;
  createdAt: string;
  updatedAt: string;
  color?:string;
}

export async function getGroups(boardId: string | number): Promise<Group[]> {
  const { data } = await api.get<Group[]>(
    `/boards/${boardId}/groups`,
  );

  return data;
}

export interface BoardTasksResponse {
  tasks: any[];
  nextCursor: number | null;
  hasMore: boolean;
  total: number;
}

export const getBoardTasks = async (
  boardId: string | number,
  params?: {
    groupId?: number;
    cursor?: number | null;
    limit?: number;
    search?: string;
    person?: string;
  },
) => {
  const { data } = await api.get<BoardTasksResponse>(
    `/boards/${boardId}/tasks`,
    {
      params,
    },
  );

  return data;
};

export interface BoardGalleryFile {
  id: number;
  name: string;
  url: string;
  type:
    | "image"
    | "video"
    | "audio"
    | "pdf"
    | "excel"
    | "document"
    | "archive"
    | "file";
  updatedAt: string;
  boardName: string;
  taskName: string;
}

export interface BoardFilesResponse {
  files: BoardGalleryFile[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getBoardFiles(
  boardId: string | number,
  params?: { type?: string; search?: string; page?: number; limit?: number },
): Promise<BoardFilesResponse> {
  const { data } = await api.get<BoardFilesResponse>(`/boards/${boardId}/files`, { params });
  return data;
}

export async function deleteBoardFile(
  boardId: string | number,
  fileId: number,
): Promise<void> {
  await api.delete(`/boards/${boardId}/files/${fileId}`);
}

export interface ImportProgress {
  pending: number;
  paused: number;
  done: number;
  total: number;
  isPaused: boolean;
}

export async function getImportProgress(boardId: string | number): Promise<ImportProgress> {
  const { data } = await api.get<ImportProgress>(`/boards/${boardId}/import-progress`);
  return data;
}

export async function pauseImport(boardId: string | number): Promise<void> {
  await api.delete(`/boards/${boardId}/import`);
}

export async function resumeImport(boardId: string | number): Promise<void> {
  await api.post(`/boards/${boardId}/import/resume`);
}