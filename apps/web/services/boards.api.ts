import { api } from "@/lib/api";
import { BoardColumnType } from "./columns.api";

export type BoardDetail = {
  id: number;
  name: string;
  workspaceId: number;
  createdAt: string;
  updatedAt: string;
  visibility: "PUBLIC" | "PRIVATE";
  createdById: number;
  columns: Array<{
    id: number;
    name: string;
    type: string;
    order: number;
    width: number;
    settings: unknown;
    boardId: number;
    createdAt: string;
    updatedAt: string;
  }>;
  members: Array<{
    id: number;
    boardId: number;
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
    boardId: number;
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

export async function getBoards(workspaceId: number | undefined) {
  const response = await api.get(`/workspaces/${workspaceId}/boards`);
  return response.data;
}

export async function getBoardDetail(
  boardId: number,
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

export async function updateBoard(
  boardId: number,
  data: Partial<CreateBoardDto>
) {
  const response = await api.patch(`/boards/${boardId}`, data);
  return response.data;
}

export async function deleteBoard(boardId: number) {
  const response = await api.delete(`/boards/${boardId}`);
  return response.data;
}

export async function exportBoard(boardId: number, boardName: string) {
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
  boardId: number | undefined,
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
  boardId: number;
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

export interface ImportExcelBoardDto {
  boardName: string;
  visibility: "PUBLIC" | "PRIVATE";
  workspaceId: number;
  taskColumn: string;
  groupColumn?: string;
  columns: ExcelColumnMappingDto[];
  rows: Record<string, unknown>[];
}

export interface ImportExcelBoardResponse {
  id: number;
  name: string;
  workspaceId: number;
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

export interface ExcelColumnMappingDto {
  sourceColumn: string;
  targetColumn: string;
  type: string;
}

export interface ImportExcelBoardDto {
  boardName: string;
  visibility: "PUBLIC" | "PRIVATE";
  workspaceId: number;
  taskColumn: string;
  groupColumn?: string;
  columns: ExcelColumnMappingDto[];
  rows: Record<string, unknown>[];
}



export interface Group {
  id: number;
  name: string;
  order: number;
  boardId: number;
  createdAt: string;
  updatedAt: string;
  color?:string;
}

export async function getGroups(boardId: number): Promise<Group[]> {
  const { data } = await api.get<Group[]>(
    `/boards/${boardId}/groups`,
  );

  return data;
}

export interface BoardTasksResponse {
  // tasks: Task[];
  tasks:any[];
  nextCursor: number | null;
  hasMore: boolean;
}

export const getBoardTasks = async (
  boardId: number,
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

export async function getBoardFiles(
  boardId: number,
): Promise<BoardGalleryFile[]> {
  const { data } = await api.get<BoardGalleryFile[]>(
    `/boards/${boardId}/files`,
  );

  return data;
}