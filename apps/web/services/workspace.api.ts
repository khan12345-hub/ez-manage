import { api } from "@/lib/api";

export type CreateWorkspaceDto = {
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
};

export type WorkspaceDetail = {
  id: number;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  updatedAt: string;
  createdById: number;
  role: string;
  createdBy?: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  members: Array<{
    id: number;
    role: string;
    createdAt: string;
    user: {
      id: number;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    userId: number;
  }>;
  invitations?: Array<{
    id: number;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    invitedBy: {
      id: number;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  }>;
  boards: Array<{
    id: number;
    name: string;
    visibility: "PUBLIC" | "PRIVATE";
    updatedAt: string;
    createdBy?: {
      id: number;
      firstName: string;
      lastName: string;
    };
    _count?: {
      members?: number;
    };
    groups?: Array<{
      _count?: { tasks?: number };
    }>;
  }>;
  _count?: {
    boards?: number;
    members?: number;
  };
};

export async function getAllWorkspaces() {
  const response = await api.get("/workspaces");
  return response.data;
}

export async function getWorkspaceDetail(workspaceId: number) {
  const response = await api.get<WorkspaceDetail>(`/workspaces/${workspaceId}`);
  return response.data;
}

export async function createWorkspace(data: CreateWorkspaceDto) {
  const response = await api.post("/workspaces", data);
  return response.data;
}

export async function updateWorkspace(
  workspaceId: number,
  data: Partial<CreateWorkspaceDto>
) {
  const response = await api.patch<WorkspaceDetail>(
    `/workspaces/${workspaceId}`,
    data
  );
  return response.data;
}

export async function deleteWorkspace(workspaceId: number) {
  const response = await api.delete(`/workspaces/${workspaceId}`);
  return response.data;
}

export async function updateWorkspaceMemberRole(
  workspaceId: number,
  memberId: number,
  role: string,
) {
  const response = await api.patch(
    `/workspaces/${workspaceId}/members/${memberId}`,
    { role },
  );
  return response.data;
}

export async function removeWorkspaceMember(
  workspaceId: number,
  memberId: number,
) {
  await api.delete(`/workspaces/${workspaceId}/members/${memberId}`);
}
