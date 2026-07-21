import { api } from "@/lib/api";

export interface CreateCommentPayload {
  content: string;
  files?: File[];
}

export interface CommentFile {
  id: number;
  commentId: number;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  storageKey: string;
  createdAt: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;

  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };

  files: CommentFile[];
}

export async function createTaskComment(
  taskId: number,
  payload: CreateCommentPayload,
): Promise<TaskComment> {
  const formData = new FormData();

  formData.append(
    "content",
    payload.content,
  );

  payload.files?.forEach((file) => {
    formData.append(
      "files",
      file,
    );
  });

  const response = await api.post<TaskComment>(
    `/tasks/${taskId}/comments`,
    formData,
  );

  return response.data;
}