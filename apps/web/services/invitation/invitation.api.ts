import { api } from "@/lib/api";

export interface BoardGroupAccessDto {
  boardId: number;
  groupIds: number[];
}

export interface CreateInvitationDto {
  email: string;
  workspaceId: number;
  boardIds: number[];
  role: string;
  boardGroupAccess?: BoardGroupAccessDto[];
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

export interface PendingInvitation {
  id: number;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  invitedBy: { firstName: string; lastName: string };
}

export async function getPendingInvitations(workspaceId: number): Promise<PendingInvitation[]> {
  const { data } = await api.get("/invitation/pending", { params: { workspaceId } });
  return data;
}

export async function revokeInvitation(invitationId: number): Promise<void> {
  await api.delete(`/invitation/${invitationId}/revoke`);
}

export interface InviteLinkResponse {
  token: string;
  url: string;
}

export async function generateWorkspaceInviteLink(
  workspaceId: number,
  role = "MEMBER",
  expiresInDays?: number,
): Promise<InviteLinkResponse> {
  const { data } = await api.post<InviteLinkResponse>("/invitation/generate-link", {
    workspaceId,
    role,
    expiresInDays,
  });
  return data;
}

export async function acceptWorkspaceInviteLink(
  token: string,
): Promise<{ joined: boolean; workspace: { id: number; name: string } }> {
  const { data } = await api.post("/invitation/accept-link", { token });
  return data;
}
