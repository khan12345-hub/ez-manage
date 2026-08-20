import { api } from "@/lib/api";

export type BoardVisibility = "PRIVATE" | "PUBLIC";

export type BoardMemberRole = "MEMBER" | "ADMIN" | "OWNER";

export interface BoardAccessMember {
  id: number;
  userId: number;
  role: BoardMemberRole;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
  };
}

export interface BoardAccess {
  id: number;
  name: string;
  visibility: BoardVisibility;
  members: BoardAccessMember[];
}

export async function getBoardAccess(boardId: number): Promise<BoardAccess> {
  const { data } = await api.get(`/boards/${boardId}/access`);

  return data;
}

export async function updateBoardVisibility(
  boardId: number,
  visibility: BoardVisibility,
) {
  const { data } = await api.patch(`/boards/${boardId}/access/visibility`, {
    visibility,
  });

  return data;
}

export async function updateBoardMemberRole(
  boardId: number,
  userId: number,
  role: BoardMemberRole,
) {
  const { data } = await api.patch(
    `/boards/${boardId}/access/members/${userId}/role`,
    {
      role,
    },
  );

  return data;
}


export async function removeBoardMember(boardId: number, userId: number) {
  const { data } = await api.delete(
    `/boards/${boardId}/access/members/${userId}`,
  );

  return data;
}
