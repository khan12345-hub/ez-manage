"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/providers/AuthProvider";
import { useChatStore } from "@/store/chat-store";
import { getChannels, getDMs, getUnreadCounts, getAllUnreadSummary } from "@/services/chat.api";
import { useInviteModalStore } from "@/store/invite-modal";
import type { ChatMessage, ChatChannel } from "@/services/chat.api";
import { playMessagePing } from "@/lib/sounds";

let socket: Socket | null = null;

// Offline message queue — flushed on socket reconnect
type QueuedMsg = {
  channelId: number;
  content: string;
  attachmentUrl?: string;
  attachmentType?: string;
  parentId?: number;
};
const offlineQueue: QueuedMsg[] = [];

/** Send a chat message; queues it if the socket is currently disconnected. */
export function sendChatMessage(msg: QueuedMsg) {
  if (socket?.connected) {
    socket.emit("message:send", msg);
  } else {
    offlineQueue.push(msg);
  }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { workspaceId } = useInviteModalStore();
  const {
    setChannels, setDMs, setUnreadCounts,
    addMessage, incrementUnread, updateMessage,
    activeChannelId, setUserOnline, setUserOffline, setOnlineUsers,
    setIncomingCall, setCallDeclinedMsg, recordChannelWorkspace,
    setWorkspaceUnreads, incrementWorkspaceUnread,
    setSocketConnected, setUserStatus,
  } = useChatStore();
  const activeChannelRef = useRef<number | null>(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);

  // Seed current user's status from /auth/me on login
  useEffect(() => {
    if (!user) return;
    if (user.chatStatusEmoji !== undefined || user.chatStatusText !== undefined) {
      setUserStatus(user.id, user.chatStatusEmoji ?? null, user.chatStatusText ?? null);
    }
    getAllUnreadSummary().then(setWorkspaceUnreads).catch(() => {});
  }, [user?.id]);

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
      const wsId = message.channel?.workspaceId;
      // Keep channelWorkspaceMap current so FAB can navigate to the right workspace
      if (wsId) recordChannelWorkspace(message.channelId, wsId);

      addMessage(message);
      if (message.userId !== user.id && message.channelId !== activeChannelRef.current) {
        incrementUnread(message.channelId);
        if (wsId) incrementWorkspaceUnread(wsId);
        playMessagePing();
      }
    });

    socket.on("user:online", ({ userId }: { userId: number }) => setUserOnline(userId));
    socket.on("user:offline", ({ userId }: { userId: number }) => setUserOffline(userId));
    socket.on("user:status", ({ userId, statusEmoji, statusText }: { userId: number; statusEmoji: string | null; statusText: string | null }) => {
      setUserStatus(userId, statusEmoji, statusText);
    });

    // When another user starts a DM with us, update our DM list in real-time
    socket.on("dm:new", (_dm: ChatChannel) => {
      if (workspaceId) getDMs(workspaceId).then(setDMs).catch(() => {});
    });

    // Global call:incoming — fires on any page when someone calls us.
    // SSE is the primary delivery path but socket covers cases where the SSE
    // stream hasn't re-established after a dev-server restart.
    socket.on("call:incoming", (d: {
      channelId: number; callType: "video" | "voice"; jitsiUrl: string;
      workspaceId: number; callerName: string; channelName: string;
      callerUserId?: number; callMessageId?: number;
    }) => {
      if (d.callerUserId && d.callerUserId === userRef.current?.id) return;
      setIncomingCall({
        channelId: d.channelId,
        callType: d.callType,
        jitsiUrl: d.jitsiUrl,
        workspaceId: d.workspaceId,
        callerName: d.callerName,
        channelName: d.channelName,
        callMessageId: d.callMessageId,
      });
    });

    // call:declined — the other party dismissed our call
    socket.on("call:declined", (d: { channelId: number; declinedByName: string }) => {
      setCallDeclinedMsg(`${d.declinedByName} dismissed the call`);
      setTimeout(() => setCallDeclinedMsg(null), 5000);
    });

    // call:joined — callee answered; start caller's duration timer
    socket.on("call:joined", ({ callMessageId }: { callMessageId?: number }) => {
      const current = useChatStore.getState().activeCall;
      if (current && (!callMessageId || current.callMessageId === callMessageId)) {
        useChatStore.getState().setActiveCall({ ...current, startedAt: Date.now() });
      }
    });

    // call:ended — caller left; dismiss incoming-call toast and update call message
    socket.on("call:ended", () => {
      setIncomingCall(null);
    });

    // message:updated — server updated an existing message (e.g. call status changed)
    socket.on("message:updated", (message: ChatMessage) => {
      updateMessage(message.id, message);
    });

    socket.emit("online:list", null, (ids: number[]) => setOnlineUsers(ids ?? []));

    // Mark connected immediately if already connected
    if (socket.connected) setSocketConnected(true);

    // Re-fetch unread counts on reconnect; flush any queued messages.
    const handleConnect = () => {
      setSocketConnected(true);
      // Flush offline queue
      while (offlineQueue.length > 0) {
        const msg = offlineQueue.shift();
        if (msg) socket?.emit("message:send", msg);
      }
      if (workspaceId) getUnreadCounts(workspaceId).then(setUnreadCounts).catch(() => {});
      getAllUnreadSummary().then(setWorkspaceUnreads).catch(() => {});
    };
    const handleDisconnect = () => setSocketConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket?.off("message:new");
      socket?.off("user:online");
      socket?.off("user:offline");
      socket?.off("user:status");
      socket?.off("dm:new");
      socket?.off("call:incoming");
      socket?.off("call:declined");
      socket?.off("call:joined");
      socket?.off("call:ended");
      socket?.off("message:updated");
      socket?.off("connect", handleConnect);
      socket?.off("disconnect", handleDisconnect);
    };
  }, [user?.id]);

  return <>{children}</>;
}

export function getSocket() { return socket; }
