import { api as apiClient } from "@/lib/api";

export interface WorkspaceDoc {
  id: number;
  name: string;
  privacy: "MAIN" | "PRIVATE" | "SHAREABLE";
  emoji?: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: number; firstName: string; lastName: string };
}

export interface WorkspaceDocDetail extends WorkspaceDoc {
  content: any;
}

export async function getWorkspaceDocs(workspaceId: number): Promise<WorkspaceDoc[]> {
  const res = await apiClient.get(`/workspaces/${workspaceId}/docs`);
  return res.data;
}

export async function getWorkspaceDoc(workspaceId: number, docId: number): Promise<WorkspaceDocDetail> {
  const res = await apiClient.get(`/workspaces/${workspaceId}/docs/${docId}`);
  return res.data;
}

export async function createWorkspaceDoc(
  workspaceId: number,
  data: { name: string; privacy?: string; emoji?: string },
): Promise<WorkspaceDoc> {
  const res = await apiClient.post(`/workspaces/${workspaceId}/docs`, data);
  return res.data;
}

export async function updateWorkspaceDoc(
  workspaceId: number,
  docId: number,
  data: { name?: string; content?: any; privacy?: string; emoji?: string },
): Promise<WorkspaceDocDetail> {
  const res = await apiClient.patch(`/workspaces/${workspaceId}/docs/${docId}`, data);
  return res.data;
}

export async function deleteWorkspaceDoc(workspaceId: number, docId: number): Promise<void> {
  await apiClient.delete(`/workspaces/${workspaceId}/docs/${docId}`);
}
