"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/providers/AuthProvider";
import { useChatStore } from "@/store/chat-store";
import { getChannels, getDMs, getUnreadCounts } from "@/services/chat.api";
import { useInviteModalStore } from "@/store/invite-modal";
import type { ChatMessage } from "@/services/chat.api";

let socket: Socket | null = null;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { workspaceId } = useInviteModalStore();
  const {
    setChannels, setDMs, setUnreadCounts,
    addMessage, incrementUnread,
    activeChannelId, setUserOnline, setUserOffline, setOnlineUsers,
  } = useChatStore();
  const activeChannelRef = useRef<number | null>(null);

  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);

  // Fetch channels + DMs when workspace changes
  useEffect(() => {
    if (!user || !workspaceId) return;
    getChannels(workspaceId).then(setChannels).catch(() => {});
    getDMs(workspaceId).then(setDMs).catch(() => {});
    getUnreadCounts(workspaceId).then(setUnreadCounts).catch(() => {});
  }, [user?.id, workspaceId]);

  // Socket connection
  useEffect(() => {
    if (!user) return;

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace("/api", "");
    if (!socket || !socket.connected) {
      socket = io(`${apiUrl}/chat`, {
        auth: { userId: user.id },
        transports: ["websocket"],
      });
    }

    socket.on("message:new", (message: ChatMessage) => {
      addMessage(message);
      if (message.userId !== user.id && message.channelId !== activeChannelRef.current) {
        incrementUnread(message.channelId);
      }
    });

    socket.on("user:online", ({ userId }: { userId: number }) => setUserOnline(userId));
    socket.on("user:offline", ({ userId }: { userId: number }) => setUserOffline(userId));

    socket.emit("online:list", null, (ids: number[]) => setOnlineUsers(ids ?? []));

    return () => {
      socket?.off("message:new");
      socket?.off("user:online");
      socket?.off("user:offline");
    };
  }, [user?.id]);

  return <>{children}</>;
}

export function getSocket() { return socket; }
