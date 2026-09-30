"use client";

import { create } from "zustand";
import { ChatChannel, ChatMessage } from "@/services/chat.api";

interface ChatStore {
  activeChannelId: number | null;
  channels: ChatChannel[];
  dms: ChatChannel[];
  messages: Record<number, ChatMessage[]>;
  unreadCounts: Record<number, number>;
  onlineUserIds: Set<number>;
  isChatOpen: boolean;

  setActiveChannel: (id: number | null) => void;
  setChannels: (channels: ChatChannel[]) => void;
  setDMs: (dms: ChatChannel[]) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (channelId: number, messages: ChatMessage[]) => void;
  setUnreadCounts: (counts: Record<number, number>) => void;
  incrementUnread: (channelId: number) => void;
  clearUnread: (channelId: number) => void;
  setOnlineUsers: (ids: number[]) => void;
  setUserOnline: (userId: number) => void;
  setUserOffline: (userId: number) => void;
  toggleChat: () => void;
  openChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeChannelId: null,
  channels: [],
  dms: [],
  messages: {},
  unreadCounts: {},
  onlineUserIds: new Set(),
  isChatOpen: false,

  setActiveChannel: (id) => set({ activeChannelId: id }),
  setChannels: (channels) => set({ channels }),
  setDMs: (dms) => set({ dms }),

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

  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  openChat: () => set({ isChatOpen: true }),
}));
