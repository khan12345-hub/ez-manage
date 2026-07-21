import { api } from "@/lib/api";

export interface GroupResponse {
  id: number;
  boardId: number;
  name: string;
  color: string | null;
  order: number;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupDto {
  name: string;
  color?: string;
}

export interface UpdateGroupDto {
  name?: string;
  color?: string;
}

export interface ReorderGroupDto {
  groupId: number;
  previousGroupId?: number | null;
  nextGroupId?: number | null;
}

/**
 * Create a group
 *
 * POST /boards/:boardId/groups
 */
export const createGroup = async (
  boardId: number,
  dto: CreateGroupDto,
) => {
  const { data } = await api.post<GroupResponse>(
    `/boards/${boardId}/groups`,
    dto,
  );

  return data;
};

/**
 * Get all groups for a board
 *
 * GET /boards/:boardId/groups
 */
export const getGroups = async (
  boardId: number,
) => {
  const { data } = await api.get<GroupResponse[]>(
    `/boards/${boardId}/groups`,
  );

  return data;
};

/**
 * Get a single group
 *
 * GET /boards/:boardId/groups/:groupId
 */
export const getGroup = async (
  boardId: number,
  groupId: number,
) => {
  const { data } = await api.get<GroupResponse>(
    `/boards/${boardId}/groups/${groupId}`,
  );

  return data;
};

/**
 * Update a group
 *
 * PATCH /boards/:boardId/groups/:groupId
 */
export const updateGroup = async (
  boardId: number | undefined,
  groupId: number,
  dto: UpdateGroupDto,
) => {
  const { data } = await api.patch<GroupResponse>(
    `/boards/${boardId}/groups/${groupId}`,
    dto,
  );

  return data;
};

/**
 * Delete a group
 *
 * DELETE /boards/:boardId/groups/:groupId
 */
export const deleteGroup = async (
  groupId: number,
  boardId: number,
) => {
  const { data } = await api.delete(
    `/boards/${boardId}/groups/${groupId}`,
  );

  return data;
};

/**
 * Reorder groups
 *
 * PATCH /boards/:boardId/groups/reorder
 */
export const reorderGroup = async (
  boardId: number,
  dto: ReorderGroupDto,
) => {
  const { data } = await api.patch(
    `/boards/${boardId}/groups/reorder`,
    dto,
  );

  return data;
};