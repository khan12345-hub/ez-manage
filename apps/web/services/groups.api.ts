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
  console.log({dto})
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

/**
 * Duplicate a group
 *
 * POST /boards/:boardId/groups/:groupId/duplicate
 */
export const duplicateGroup = async (
  boardId: number,
  groupId: number,
  withUpdates: boolean,
) => {
  const { data } = await api.post(
    `/boards/${boardId}/groups/${groupId}/duplicate`,
    { withUpdates },
  );

  return data;
};

/**
 * Archive a group (sets isArchived: true)
 *
 * PATCH /boards/:boardId/groups/:groupId
 */
export const archiveGroup = async (
  boardId: number,
  groupId: number,
) => {
  const { data } = await api.patch(
    `/boards/${boardId}/groups/${groupId}`,
    { isArchived: true },
  );

  return data;
};

/**
 * Get archived groups for a board
 *
 * GET /boards/:boardId/groups/archived
 */
export const getArchivedGroups = async (boardId: number) => {
  const { data } = await api.get<{
    id: number;
    name: string;
    color: string | null;
    updatedAt: string;
    _count: { tasks: number };
  }[]>(`/boards/${boardId}/groups/archived`);
  return data;
};

/**
 * Unarchive a group (sets isArchived: false)
 *
 * PATCH /boards/:boardId/groups/:groupId
 */
export const unarchiveGroup = async (boardId: number, groupId: number) => {
  const { data } = await api.patch(
    `/boards/${boardId}/groups/${groupId}`,
    { isArchived: false },
  );
  return data;
};

/**
 * Export a single group to Excel
 *
 * GET /boards/:boardId/export?groupId=:groupId
 */
export const exportGroupExcel = async (
  boardId: number,
  groupId: number,
  groupName: string,
) => {
  const response = await api.get(
    `/boards/${boardId}/export?groupId=${groupId}`,
    { responseType: 'blob' },
  );

  const url = URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${groupName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'group'}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};