import { api } from "@/lib/api";

export type CreateWorkspaceDto = {
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
};

export type WorkspaceDetail = {
  id: number;
  uid: string;
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
    uid: string;
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

export async function getWorkspaceDetail(workspaceId: string | number) {
  const response = await api.get<WorkspaceDetail>(`/workspaces/${workspaceId}`);
  return response.data;
}

export async function createWorkspace(data: CreateWorkspaceDto) {
  const response = await api.post("/workspaces", data);
  return response.data;
}

export async function updateWorkspace(
  workspaceId: string | number,
  data: Partial<CreateWorkspaceDto>
) {
  const response = await api.patch<WorkspaceDetail>(
    `/workspaces/${workspaceId}`,
    data
  );
  return response.data;
}

export async function deleteWorkspace(workspaceId: string | number) {
  const response = await api.delete(`/workspaces/${workspaceId}`);
  return response.data;
}

export async function updateWorkspaceMemberRole(
  workspaceId: string | number,
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
  workspaceId: string | number,
  memberId: number,
  force = false,
) {
  await api.delete(`/workspaces/${workspaceId}/members/${memberId}`, {
    params: force ? { force: "true" } : undefined,
  });
}

export interface CapacityTask {
  id: number;
  name: string;
  boardId: number;
  boardName: string;
  groupId: number;
  groupName: string;
  dueDate: string | null;
  statusLabel: string | null;
  statusColor: string | null;
}

export interface CapacityMember {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  totalTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  onTrackTasks: number;
  noDueDateTasks: number;
  tasks: CapacityTask[];
}

export async function getWorkspaceCapacity(workspaceId: string | number): Promise<CapacityMember[]> {
  const { data } = await api.get<CapacityMember[]>(`/workspaces/${workspaceId}/capacity`);
  return data;
}

export interface WorkspaceCalendarTask {
  id: number;
  name: string;
  date: string;
  groupId: number;
  groupName: string;
  groupColor: string | null;
  boardId: number;
  boardName: string;
}

export async function getWorkspaceCalendarTasks(
  workspaceId: string | number,
  month: number,
  year: number,
): Promise<WorkspaceCalendarTask[]> {
  const { data } = await api.get<WorkspaceCalendarTask[]>(
    `/workspaces/${workspaceId}/calendar-tasks`,
    { params: { month, year } },
  );
  return data;
}
