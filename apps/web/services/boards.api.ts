import { api } from "@/lib/api";

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

// export async function getBoardDetail(boardId: number) {
//   const response = await api.get<BoardDetail>(`/boards/${boardId}`);
//   return response.data;
// }

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

export interface BoardMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
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