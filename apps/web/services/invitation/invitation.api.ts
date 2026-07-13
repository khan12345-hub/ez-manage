import { api } from "@/lib/api";

export interface CreateInvitationDto {
  email: string;
  workspaceId: number;
  boardIds: number[];
  role: string;
}

export interface CreateInvitationResponse {
  id: number;
  email: string;
  workspaceId: number;
  boardId: number;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function createInvitation(data: CreateInvitationDto): Promise<CreateInvitationResponse> {
  const response = await api.post<CreateInvitationResponse>("/invitation/create", data);
  return response.data;
}
