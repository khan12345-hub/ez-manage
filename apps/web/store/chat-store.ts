"use client";

import { create } from "zustand";
import { ChatChannel, ChatMessage, WorkspaceUnreadSummary } from "@/services/chat.api";

export interface IncomingCall {
  channelId: number;
  callType: "video" | "voice";
  roomName: string;
  workspaceId: number;
  callerName: string;
  channelName: string;
  callMessageId?: number;
}

export interface ActiveCall {
  roomName: string;
  channelId: number;
  startWithVideoMuted: boolean;
  livekitToken: string;
  livekitUrl: string;
  callMessageId?: number;
  startedAt?: number; // Date.now() when call connected
}

interface ChatStore {
  activeChannelId: number | null;
  channels: ChatChannel[];
  dms: ChatChannel[];
  messages: Record<number, ChatMessage[]>;
  unreadCounts: Record<number, number>;
  onlineUserIds: Set<number>;
  /** userId → current status */
  userStatuses: Record<number, { emoji: string | null; text: string | null }>;
  isChatOpen: boolean;
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  callDeclinedMsg: string | null;
  /** channelId → workspaceId — accumulates across workspace switches for cross-workspace navigation */
  channelWorkspaceMap: Record<number, number>;
  /** Per-workspace unread totals across ALL workspaces */
  workspaceUnreads: WorkspaceUnreadSummary[];
  /** Live socket connection state */
  isSocketConnected: boolean;

  setActiveChannel: (id: number | null) => void;
  setChannels: (channels: ChatChannel[]) => void;
  setDMs: (dms: ChatChannel[]) => void;
  recordChannelWorkspace: (channelId: number, workspaceId: number) => void;
  setWorkspaceUnreads: (unreads: WorkspaceUnreadSummary[]) => void;
  incrementWorkspaceUnread: (workspaceId: number) => void;
  clearWorkspaceUnread: (workspaceId: number) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (channelId: number, messages: ChatMessage[]) => void;
  setUnreadCounts: (counts: Record<number, number>) => void;
  incrementUnread: (channelId: number) => void;
  clearUnread: (channelId: number) => void;
  setOnlineUsers: (ids: number[]) => void;
  setUserOnline: (userId: number) => void;
  setUserOffline: (userId: number) => void;
  setUserStatus: (userId: number, emoji: string | null, text: string | null) => void;
  toggleChat: () => void;
  openChat: () => void;
  setIncomingCall: (call: IncomingCall | null) => void;
  setActiveCall: (call: ActiveCall | null) => void;
  setCallDeclinedMsg: (msg: string | null) => void;
  setSocketConnected: (v: boolean) => void;
  updateMessage: (messageId: number, updates: Partial<ChatMessage>) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeChannelId: null,
  channels: [],
  dms: [],
  messages: {},
  unreadCounts: {},
  onlineUserIds: new Set(),
  userStatuses: {},
  isChatOpen: false,
  incomingCall: null,
  activeCall: null,
  callDeclinedMsg: null,
  channelWorkspaceMap: {},
  workspaceUnreads: [],
  isSocketConnected: false,

  setActiveChannel: (id) => set({ activeChannelId: id }),

  setChannels: (channels) =>
    set((s) => {
      const map = { ...s.channelWorkspaceMap };
      channels.forEach((c) => { if (c.workspaceId) map[c.id] = c.workspaceId; });
      return { channels, channelWorkspaceMap: map };
    }),

  setDMs: (dms) =>
    set((s) => {
      const map = { ...s.channelWorkspaceMap };
      dms.forEach((c) => { if (c.workspaceId) map[c.id] = c.workspaceId; });
      return { dms, channelWorkspaceMap: map };
    }),

  recordChannelWorkspace: (channelId, workspaceId) =>
    set((s) => ({
      channelWorkspaceMap: { ...s.channelWorkspaceMap, [channelId]: workspaceId },
    })),

  setWorkspaceUnreads: (unreads) => set({ workspaceUnreads: unreads }),

  incrementWorkspaceUnread: (workspaceId) =>
    set((s) => {
      const exists = s.workspaceUnreads.find((w) => w.workspaceId === workspaceId);
      if (exists) {
        return {
          workspaceUnreads: s.workspaceUnreads.map((w) =>
            w.workspaceId === workspaceId ? { ...w, totalUnread: w.totalUnread + 1 } : w,
          ),
        };
      }
      return s; // unknown workspace — don't add phantom entries
    }),

  clearWorkspaceUnread: (workspaceId) =>
    set((s) => ({
      workspaceUnreads: s.workspaceUnreads.map((w) =>
        w.workspaceId === workspaceId ? { ...w, totalUnread: 0 } : w,
      ),
    })),

  addMessage: (message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [message.channelId]: [...(s.messages[message.channelId] ?? []), message],
      },
    })),

  setMessages: (channelId, messages) =>
    set((s) => ({ messages: { ...s.messages, [channelId] : messages } })),

  setUnreadCounts: (counts) => set({ unreadCounts: counts }),

  incrementUnread: (channelId) =>
    set((s) => ({
      unreadCounts: {
        ...s.unreadCounts,
        [channelId]: (s.unreadCounts[channelId] ?? 0) + 1,
      },
    })),

  clearUnread: (channelId) =>
    set((s) => ({
      unreadCounts: { ...s.unreadCounts, [channelId]: 0 },
    })),

  setOnlineUsers: (ids) => set({ onlineUserIds: new Set(ids) }),

  setUserOnline: (userId) =>
    set((s) => ({ onlineUserIds: new Set([...s.onlineUserIds, userId]) })),

  setUserOffline: (userId) =>
    set((s) => {
      const next = new Set(s.onlineUserIds);
      next.delete(userId);
      return { onlineUserIds: next };
    }),

  setUserStatus: (userId, emoji, text) =>
    set((s) => ({ userStatuses: { ...s.userStatuses, [userId]: { emoji, text } } })),

  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  openChat: () => set({ isChatOpen: true }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setActiveCall: (call) => set({ activeCall: call }),
  setCallDeclinedMsg: (msg) => set({ callDeclinedMsg: msg }),
  setSocketConnected: (v) => set({ isSocketConnected: v }),

  updateMessage: (messageId, updates) =>
    set((s) => {
      const newMessages: Record<number, ChatMessage[]> = {};
      for (const [chId, msgs] of Object.entries(s.messages)) {
        const idx = msgs.findIndex((m) => m.id === messageId);
        newMessages[Number(chId)] = idx === -1
          ? msgs
          : [...msgs.slice(0, idx), { ...msgs[idx], ...updates } as ChatMessage, ...msgs.slice(idx + 1)];
      }
      return { messages: newMessages };
    }),
}));
