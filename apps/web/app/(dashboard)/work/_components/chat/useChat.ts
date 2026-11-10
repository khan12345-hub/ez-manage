"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WORK_CHAT_EVENT, type WorkChatEvent } from "@/services/notifications.sse";
import { workApi, type ChatMessage } from "@/services/work.api";

export const chatSidebarKey = (ws: string) => ["work", "chat-sidebar", ws] as const;
export const messagesKey = (uid: string) => ["work", "chat-messages", uid] as const;
export const threadKey = (id: number) => ["work", "chat-thread", id] as const;
export const channelKey = (uid: string) => ["work", "chat-channel", uid] as const;

export function useWs() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return workspaceId ?? "";
}

export function useChatSidebar() {
  const ws = useWs();
  return useQuery({ queryKey: chatSidebarKey(ws), queryFn: () => workApi.chatSidebar(ws), enabled: !!ws, refetchInterval: 60_000 });
}

/** subscribe to live Work chat events (from the notification stream) */
export function useChatEvents(handler: (e: WorkChatEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = (ev: Event) => ref.current((ev as CustomEvent<WorkChatEvent>).detail);
    window.addEventListener(WORK_CHAT_EVENT, on);
    return () => window.removeEventListener(WORK_CHAT_EVENT, on);
  }, []);
}

type Page = { items: ChatMessage[]; hasMore: boolean };

/** a channel's messages, kept live: new ones appended, edits / reactions replaced */
export function useChannelMessages(uid: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: messagesKey(uid), queryFn: () => workApi.chatMessages(uid), enabled: !!uid });
  useChatEvents((e) => {
    if (e.channelUid !== uid || !e.message) return;
    const m = e.message as ChatMessage;
    if (e.type === "message") {
      // thread replies also refresh their thread + the parent's reply count
      if (m.parentId) {
        qc.invalidateQueries({ queryKey: threadKey(m.parentId) });
        qc.setQueryData<Page>(messagesKey(uid), (old) => old && { ...old, items: old.items.map((x) => (x.id === m.parentId ? { ...x, replyCount: x.replyCount + 1, lastReplyAt: m.createdAt } : x)) });
        if (!m.alsoInChannel) return;
      }
      qc.setQueryData<Page>(messagesKey(uid), (old) => (old ? (old.items.some((x) => x.id === m.id) ? old : { ...old, items: [...old.items, { ...m, mine: false }] }) : old));
    }
    if (e.type === "message_updated") {
      const keep = (x: ChatMessage) => (x.id === m.id ? { ...m, mine: x.mine, saved: x.saved } : x);
      qc.setQueryData<Page>(messagesKey(uid), (old) => old && { ...old, items: old.items.map(keep) });
      if (m.parentId) qc.invalidateQueries({ queryKey: threadKey(m.parentId) });
      else qc.invalidateQueries({ queryKey: threadKey(m.id) });
    }
  });
  return q;
}

export function addOwnMessage(qc: ReturnType<typeof useQueryClient>, uid: string, m: ChatMessage) {
  qc.setQueryData<Page>(messagesKey(uid), (old) => (old ? (old.items.some((x) => x.id === m.id) ? old : { ...old, items: [...old.items, m] }) : old));
}

export const POST_TYPES = [
  { id: "announcement", label: "Announcement", color: "#DC2626" },
  { id: "discussion", label: "Discussion", color: "#DB2777" },
  { id: "idea", label: "Idea", color: "#CA8A04" },
  { id: "update", label: "Update", color: "#2563EB" },
] as const;
export const CHAT_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🙏", "🔥", "✅", "🚀", "💯", "👏", "😮"];
