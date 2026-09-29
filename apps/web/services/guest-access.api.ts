import { api } from "@/lib/api";
import axios from "axios";

export async function getGuestToken(boardId: number): Promise<{ token: string | null }> {
  const { data } = await api.get(`/boards/${boardId}/guest-token`);
  return data;
}

export async function generateGuestToken(boardId: number): Promise<{ token: string }> {
  const { data } = await api.post(`/boards/${boardId}/guest-token`);
  return data;
}

export async function revokeGuestToken(boardId: number): Promise<{ revoked: boolean }> {
  const { data } = await api.delete(`/boards/${boardId}/guest-token`);
  return data;
}

// Public — no auth header needed
export async function getGuestBoard(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const { data } = await axios.get(`${baseUrl}/public/guest/${token}`);
  return data;
}
