import { api } from "@/lib/api";

export interface ChatUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  createdAt: string;
  editedAt: string | null;
  user: ChatUser;
}

export interface ChatChannel {
  id: number;
  workspaceId: number;
  name: string | null;
  description: string | null;
  type: "CHANNEL" | "DIRECT";
  createdById: number;
  createdAt: string;
  updatedAt: string;
  members: {
    userId: number;
    lastReadAt: string | null;
    user?: ChatUser;
  }[];
  messages: { content: string; createdAt: string; userId?: number }[];
}

// ── Channels ──────────────────────────────────────────────────────────────────

export async function getChannels(workspaceId: number): Promise<ChatChannel[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/channels`);
  return data;
}

export async function createChannel(
  workspaceId: number,
  name: string,
  description?: string,
): Promise<ChatChannel> {
  const { data } = await api.post(`/workspaces/${workspaceId}/chat/channels`, {
    name,
    description,
  });
  return data;
}

export async function joinChannel(workspaceId: number, channelId: number) {
  const { data } = await api.post(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/join`,
  );
  return data;
}

// ── Direct Messages ───────────────────────────────────────────────────────────

export async function getDMs(workspaceId: number): Promise<ChatChannel[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/dms`);
  return data;
}

export async function getOrCreateDM(
  workspaceId: number,
  userId: number,
): Promise<ChatChannel> {
  const { data } = await api.post(`/workspaces/${workspaceId}/chat/dms`, { userId });
  return data;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function getMessages(
  workspaceId: number,
  channelId: number,
  cursor?: number,
): Promise<ChatMessage[]> {
  const { data } = await api.get(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/messages`,
    { params: cursor ? { cursor } : {} },
  );
  return data;
}

export async function deleteMessage(workspaceId: number, messageId: number) {
  await api.delete(`/workspaces/${workspaceId}/chat/messages/${messageId}`);
}

export async function markRead(workspaceId: number, channelId: number) {
  await api.post(`/workspaces/${workspaceId}/chat/channels/${channelId}/read`);
}

export async function getUnreadCounts(
  workspaceId: number,
): Promise<Record<number, number>> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/unread`);
  return data;
}

export async function getWorkspaceMembers(
  workspaceId: number,
): Promise<{ user: ChatUser }[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/members`);
  return data;
}
