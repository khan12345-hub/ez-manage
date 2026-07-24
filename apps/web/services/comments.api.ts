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

  replies: TaskComment[];
}

export async function createTaskComment(
  taskId: number,
  payload: CreateCommentPayload,
): Promise<TaskComment> {
  const formData = new FormData();

  formData.append("content", payload.content);

  payload.files?.forEach((file) => {
    formData.append("files", file);
  });

  const response = await api.post<TaskComment>(
    `/tasks/${taskId}/comments`,
    formData,
  );

  return response.data;
}

export interface TaskCommentUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
}

export interface TaskCommentFile {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
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
  user: TaskCommentUser;
  files: CommentFile[];
}

export interface GetTaskCommentsResponse {
  data: TaskComment[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export async function getTaskComments(
  taskId: number,
  page = 1,
  limit = 20,
): Promise<GetTaskCommentsResponse> {
  const response = await api.get<GetTaskCommentsResponse>(
    `/tasks/${taskId}/comments`,
    {
      params: {
        page,
        limit,
      },
    },
  );

  return response.data;
}

export async function createCommentReply(
  taskId: number,
  commentId: number,
  content: string,
  files: File[] = [],
) {
  const formData = new FormData();

  formData.append("content", content);

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await api.post(
    `/tasks/${taskId}/comments/${commentId}/replies`,
    formData,
  );

  return response.data;
}

export interface UpdateCommentPayload {
  content: string;
}
export const updateComment = async (
  taskId: number,
  commentId: number,
  payload: UpdateCommentPayload,
) => {
  const { data } = await api.patch(
    `/tasks/${taskId}/comments/${commentId}`,
    payload,
  );
  return data;
};
export const deleteComment = async (taskId: number, commentId: number) => {
  const { data } = await api.delete(`/tasks/${taskId}/comments/${commentId}`);
  return data;
};
export const deleteCommentFile = async (commentId: number, fileId: number) => {
  const response = await api.delete(
    `/tasks/comments/${commentId}/files/${fileId}`,
  );

  return response.data;
};
