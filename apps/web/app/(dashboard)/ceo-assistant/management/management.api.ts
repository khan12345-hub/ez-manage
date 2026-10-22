import { api } from "@/lib/api";
import { MyTaskItem } from "@/services/ceo-assistant.api";

export interface ManagementMemberStats {
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  inactiveTasks: number;
}

export interface ManagementMember {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  workspaces: { workspaceId: number; workspaceName: string; role: string }[];
  addedManually: boolean;
  stats: ManagementMemberStats;
}

export interface ManagerDetail {
  user: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null };
  tasks: MyTaskItem[];
  taskStats: ManagementMemberStats;
  team: {
    userId: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    workspaceId: number;
    workspaceName: string;
    role: string;
    stats: ManagementMemberStats;
  }[];
  workspaces: { workspaceId: number; workspaceName: string; boardCount: number; memberCount: number; role: string }[];
}

export interface MemberDetail {
  user: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null };
  tasks: MyTaskItem[];
  stats: ManagementMemberStats;
}

export interface WorkspaceAssignee {
  userId: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  inactiveTasks: number;
  tasks: MyTaskItem[];
}

export interface WorkspaceDetail {
  workspace: { id: number; name: string; boardCount: number; memberCount: number };
  assignees: WorkspaceAssignee[];
}

export interface CeoTaskDetail {
  id: number;
  name: string;
  boardId: number;
  boardName: string;
  workspaceId: number;
  workspaceName: string;
  groupName: string;
  dueDate: string | null;
  daysOverdue: number | null;
  status: { label: string; color: string } | null;
  assignees: { id: number; firstName: string; lastName: string; avatarUrl: string | null }[];
  comments: {
    id: number;
    content: string;
    createdAt: string;
    author: { id: number; firstName: string; lastName: string; avatarUrl: string | null };
  }[];
  lastActivityAt: string;
}

export async function getManagementTeam(): Promise<{ members: ManagementMember[]; hiddenMembers: ManagementMember[] }> {
  const { data } = await api.get("/ceo-assistant/management");
  return data;
}

export async function searchManagementUsers(q: string): Promise<{ id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null }[]> {
  const { data } = await api.get(`/ceo-assistant/management/search?q=${encodeURIComponent(q)}`);
  return data;
}

export async function getManagerDetail(userId: number): Promise<ManagerDetail> {
  const { data } = await api.get(`/ceo-assistant/management/${userId}`);
  return data;
}

export async function getMemberDetail(userId: number): Promise<MemberDetail> {
  const { data } = await api.get(`/ceo-assistant/management/member/${userId}`);
  return data;
}

export async function getWorkspaceDetail(workspaceId: number): Promise<WorkspaceDetail> {
  const { data } = await api.get(`/ceo-assistant/workspaces/${workspaceId}/detail`);
  return data;
}

export async function addToManagementTeam(memberId: number): Promise<{ success: boolean }> {
  const { data } = await api.post("/ceo-assistant/management/add", { memberId });
  return data;
}

export async function hideMember(memberId: number): Promise<{ success: boolean }> {
  const { data } = await api.post(`/ceo-assistant/management/${memberId}/hide`);
  return data;
}

export async function showMember(memberId: number): Promise<{ success: boolean }> {
  const { data } = await api.post(`/ceo-assistant/management/${memberId}/show`);
  return data;
}

export async function getCeoTaskDetail(taskId: number): Promise<CeoTaskDetail> {
  const { data } = await api.get(`/ceo-assistant/tasks/${taskId}`);
  return data;
}

export async function addCommentToTask(taskId: number, content: string): Promise<{ id: number; content: string; createdAt: string }> {
  const { data } = await api.post(`/ceo-assistant/tasks/${taskId}/comment`, { content });
  return data;
}

export async function sendTaskNotification(taskId: number, assigneeId: number, message: string): Promise<{ sent: boolean }> {
  const { data } = await api.post(`/ceo-assistant/tasks/${taskId}/notify`, { assigneeId, message });
  return data;
}

export async function markTaskDone(taskId: number): Promise<{ success: boolean; status: { label: string; color: string } }> {
  const { data } = await api.post(`/ceo-assistant/tasks/${taskId}/mark-done`);
  return data;
}

export async function reassignTask(taskId: number, assigneeId: number): Promise<{ success: boolean; assignee: { id: number; firstName: string; lastName: string; avatarUrl: string | null } }> {
  const { data } = await api.post(`/ceo-assistant/tasks/${taskId}/reassign`, { assigneeId });
  return data;
}

export async function getTaskWorkspaceMembers(taskId: number): Promise<{ id: number; firstName: string; lastName: string; avatarUrl: string | null }[]> {
  const { data } = await api.get(`/ceo-assistant/tasks/${taskId}/workspace-members`);
  return data;
}
