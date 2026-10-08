import { api } from "@/lib/api";

export interface ChatUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  chatStatusEmoji?: string | null;
  chatStatusText?: string | null;
}

export interface ChatMessage {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  attachmentUrl: string | null;
  attachmentType: "image" | "file" | null;
  parentId: number | null;
  createdAt: string;
  editedAt: string | null;
  user: ChatUser;
  assignedTo: ChatUser | null;
  _count?: { replies: number };
  channel?: { workspaceId: number | null };
  reactions?: { id: number; userId: number; emoji: string }[];
  // System / call messages
  isSystemMessage?: boolean;
  callType?: "video" | "voice" | null;
  callStatus?: "ongoing" | "ended" | "declined" | "missed" | null;
  callDuration?: number | null;
  isPinned?: boolean;
}

export type ChatNotifPref = "ALL" | "MENTIONS" | "MUTED";

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
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
    notifPref?: ChatNotifPref;
    user?: ChatUser;
  }[];
  messages: { content: string; createdAt: string; userId?: number }[];
}

// ── Channels ──────────────────────────────────────────────────────────────────

export async function getChannels(workspaceId: number): Promise<ChatChannel[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/channels`);
  return data;
}

export async function ensureGeneralChannel(workspaceId: number): Promise<void> {
  await api.post(`/workspaces/${workspaceId}/chat/ensure-general`);
}

export async function createChannel(
  workspaceId: number,
  name: string,
  description?: string,
  memberIds?: number[],
): Promise<ChatChannel> {
  const { data } = await api.post(`/workspaces/${workspaceId}/chat/channels`, {
    name,
    description,
    memberIds,
  });
  return data;
}

export async function updateChannel(
  workspaceId: number,
  channelId: number,
  data: { name?: string; description?: string },
): Promise<ChatChannel> {
  const { data: res } = await api.patch(
    `/workspaces/${workspaceId}/chat/channels/${channelId}`,
    data,
  );
  return res;
}

export async function joinChannel(workspaceId: number, channelId: number) {
  const { data } = await api.post(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/join`,
  );
  return data;
}

export async function setChannelPref(
  workspaceId: number,
  channelId: number,
  notifPref: ChatNotifPref,
): Promise<{ notifPref: ChatNotifPref }> {
  const { data } = await api.patch(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/prefs`,
    { notifPref },
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

export async function toggleReaction(
  workspaceId: number,
  messageId: number,
  emoji: string,
): Promise<ChatMessage> {
  const { data } = await api.post(
    `/workspaces/${workspaceId}/chat/messages/${messageId}/reactions`,
    { emoji },
  );
  return data;
}

export async function editMessage(
  workspaceId: number,
  messageId: number,
  content: string,
): Promise<ChatMessage> {
  const { data } = await api.patch(
    `/workspaces/${workspaceId}/chat/messages/${messageId}`,
    { content },
  );
  return data;
}

export async function deleteMessage(workspaceId: number, messageId: number) {
  await api.delete(`/workspaces/${workspaceId}/chat/messages/${messageId}`);
}

export async function getReplies(workspaceId: number, messageId: number): Promise<ChatMessage[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/messages/${messageId}/replies`);
  return data;
}

export async function assignMessage(workspaceId: number, messageId: number, assigneeId: number): Promise<ChatMessage> {
  const { data } = await api.post(`/workspaces/${workspaceId}/chat/messages/${messageId}/assign`, { assigneeId });
  return data;
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

export interface WorkspaceUnreadSummary {
  workspaceId: number;
  workspaceName: string;
  totalUnread: number;
}

export async function getAllUnreadSummary(): Promise<WorkspaceUnreadSummary[]> {
  const { data } = await api.get('/chat/all-unread');
  return data;
}

export async function getWorkspaceMembers(
  workspaceId: number,
): Promise<{ user: ChatUser }[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/members`);
  return data;
}

// Returns ALL system users for DM picker
export async function getAllChatUsers(
  workspaceId: number,
): Promise<{ userId: number; user: ChatUser & { email: string } }[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/users`);
  return data;
}

export async function assignChatMessage(
  workspaceId: number,
  messageId: number,
  assigneeId: number,
): Promise<void> {
  await api.post(`/workspaces/${workspaceId}/chat/messages/${messageId}/assign`, { assigneeId });
}

export async function getChannelMembers(
  workspaceId: number,
  channelId: number,
): Promise<{ userId: number; user: ChatUser }[]> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/channels/${channelId}/members`);
  return data;
}

export async function addChannelMember(
  workspaceId: number,
  channelId: number,
  userId: number,
): Promise<void> {
  await api.post(`/workspaces/${workspaceId}/chat/channels/${channelId}/members`, { userId });
}

export async function removeChannelMember(
  workspaceId: number,
  channelId: number,
  userId: number,
): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/chat/channels/${channelId}/members/${userId}`);
}

export interface UploadResult {
  url: string;
  originalName: string;
  type: "image" | "file";
  mimeType: string;
  size: number;
}

export async function uploadChatFile(
  workspaceId: number,
  channelId: number,
  file: File,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/upload`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchMessages(
  workspaceId: number,
  channelId: number,
  query: string,
): Promise<ChatMessage[]> {
  const { data } = await api.get(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/search`,
    { params: { q: query } },
  );
  return data;
}

// ── Pin Messages ──────────────────────────────────────────────────────────────

export async function pinMessage(
  workspaceId: number,
  messageId: number,
  pin = true,
): Promise<ChatMessage> {
  const { data } = await api.post(
    `/workspaces/${workspaceId}/chat/messages/${messageId}/pin`,
    { pin },
  );
  return data;
}

export async function getPinnedMessages(
  workspaceId: number,
  channelId: number,
): Promise<ChatMessage[]> {
  const { data } = await api.get(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/pinned`,
  );
  return data;
}

// ── Read receipts ─────────────────────────────────────────────────────────────

export async function getSeenBy(
  workspaceId: number,
  messageId: number,
): Promise<ChatUser[]> {
  const { data } = await api.get(
    `/workspaces/${workspaceId}/chat/messages/${messageId}/seen-by`,
  );
  return data;
}

// ── Scheduled Messages ────────────────────────────────────────────────────────

export interface ScheduledMessage {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  scheduledAt: string;
  status: "PENDING" | "SENT" | "CANCELLED";
  createdAt: string;
  user?: ChatUser;
}

export async function createScheduledMessage(
  workspaceId: number,
  channelId: number,
  content: string,
  scheduledAt: string,
): Promise<ScheduledMessage> {
  const { data } = await api.post(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/scheduled`,
    { content, scheduledAt },
  );
  return data;
}

export async function listScheduledMessages(
  workspaceId: number,
  channelId: number,
): Promise<ScheduledMessage[]> {
  const { data } = await api.get(
    `/workspaces/${workspaceId}/chat/channels/${channelId}/scheduled`,
  );
  return data;
}

export async function cancelScheduledMessage(
  workspaceId: number,
  id: number,
): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/chat/scheduled/${id}`);
}

// ── User Status ───────────────────────────────────────────────────────────────

export async function setUserStatus(
  emoji: string | null,
  text: string | null,
  clearsAt?: string | null,
): Promise<void> {
  await api.patch('/auth/status', { emoji, text, clearsAt: clearsAt ?? null });
}

// ── Link Preview ──────────────────────────────────────────────────────────────

export async function fetchLinkPreview(
  workspaceId: number,
  url: string,
): Promise<LinkPreview> {
  const { data } = await api.get(`/workspaces/${workspaceId}/chat/link-preview`, {
    params: { url },
  });
  return data;
}

export async function getLiveKitToken(
  roomName: string,
): Promise<{ token: string; wsUrl: string }> {
  const { data } = await api.post('/chat/livekit-token', { roomName });
  return data;
}
