import { api } from "@/lib/api";

export interface SystemOverview {
  users: { total: number; newThisMonth: number };
  workspaces: { total: number };
  boards: { total: number };
  tasks: { total: number };
  storage: {
    totalBytes: number;
    totalFiles: number;
    imageBytes: number;
    videoBytes: number;
    docBytes: number;
  };
}

export interface AdminWorkspace {
  id: number;
  name: string;
  createdAt: string;
  members: number;
  boards: number;
  tasks: number;
}

export interface AdminBoard {
  id: number;
  name: string;
  workspaceName: string;
  groups: number;
  tasks: number;
}

export interface AdminFile {
  id: number;
  name: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  boardName: string | null;
}

export async function getSystemOverview(): Promise<SystemOverview> {
  const { data } = await api.get<SystemOverview>("/admin/overview");
  return data;
}

export async function getAllWorkspaces(): Promise<AdminWorkspace[]> {
  const { data } = await api.get<AdminWorkspace[]>("/admin/workspaces");
  return data;
}

export async function deleteAdminWorkspace(id: number): Promise<void> {
  await api.delete(`/admin/workspaces/${id}`);
}

export async function getAllBoards(): Promise<AdminBoard[]> {
  const { data } = await api.get<AdminBoard[]>("/admin/boards");
  return data;
}

export async function deleteAdminBoard(id: number): Promise<void> {
  await api.delete(`/admin/boards/${id}`);
}

export async function getAllFiles(): Promise<AdminFile[]> {
  const { data } = await api.get<AdminFile[]>("/admin/files");
  return data;
}

export async function deleteAdminFile(id: number): Promise<void> {
  await api.delete(`/admin/files/${id}`);
}
