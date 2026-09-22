import { api } from "@/lib/api";

export interface FileCommentUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface FileComment {
  id: number;
  fileId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: FileCommentUser;
  assignedTo: FileCommentUser | null;
}

export async function getFileComments(fileId: number): Promise<FileComment[]> {
  const response = await api.get<FileComment[]>(`/files/${fileId}/comments`);
  return response.data;
}

export async function createFileComment(
  fileId: number,
  content: string,
  assignedToId?: number
): Promise<FileComment> {
  const response = await api.post<FileComment>(`/files/${fileId}/comments`, {
    content,
    ...(assignedToId ? { assignedToId } : {}),
  });
  return response.data;
}

export async function deleteFileComment(
  fileId: number,
  commentId: number
): Promise<void> {
  await api.delete(`/files/${fileId}/comments/${commentId}`);
}
