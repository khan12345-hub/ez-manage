import { api } from "@/lib/api";

export interface CreateGroupDto {
  boardId: number;
  name: string;
  color: string;
}

export interface UpdateGroupDto {
  boardId: number;
  name?: string;
  color?: string;
}

export interface DeleteGroupDto {
  boardId: number;
}

export interface GroupResponse {
  id: number;
  boardId: number;
  name: string;
  color: string;
  order: number;
}

export async function createGroup(data: CreateGroupDto) {
    console.log("payload", data)
  const response = await api.post<GroupResponse>("/groups", data);
  return response.data;
}

export async function updateGroup(
  id: number,
  data: UpdateGroupDto,
) {
  const response = await api.patch<GroupResponse>(
    `/groups/${id}`,
    data,
  );

  return response.data;
}

export async function deleteGroup(
  id: number,
  data: DeleteGroupDto,
) {
  await api.delete(`/groups/${id}`, {
    data,
  });
}