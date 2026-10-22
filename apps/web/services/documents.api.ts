import { api } from "@/lib/api";

export interface BoardDocumentDto {
  id: number;
  boardId: number;
  title: string;
  content: any;
  icon?: string | null;
  order: number;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export async function getBoardDocuments(boardId: string | number): Promise<BoardDocumentDto[]> {
  const response = await api.get(`/boards/${boardId}/documents`);
  return response.data;
}

export async function createBoardDocument(
  boardId: string | number,
  data: { title: string; content: any },
): Promise<BoardDocumentDto> {
  const response = await api.post(`/boards/${boardId}/documents`, data);
  return response.data;
}

export async function updateBoardDocument(
  boardId: string | number,
  id: number,
  data: { title?: string; content?: any },
): Promise<BoardDocumentDto> {
  const response = await api.patch(`/boards/${boardId}/documents/${id}`, data);
  return response.data;
}

export async function deleteBoardDocument(boardId: string | number, id: number): Promise<void> {
  await api.delete(`/boards/${boardId}/documents/${id}`);
}
