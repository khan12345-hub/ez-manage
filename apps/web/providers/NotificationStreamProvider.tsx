"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

import { connectNotificationStream, ChatUnreadEvent, ChatCallEvent } from "@/services/notifications.sse";
import { getUnreadNotificationCount } from "@/services/notifications.api";
import { useChatStore } from "@/store/chat-store";

interface Notification {
  id: string;
  recipientId: number;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  eventKey?: string | null;
}

interface NotificationsResponse {
  data: Notification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Props {
  userId: number;
  children: React.ReactNode;
}

export function NotificationStreamProvider({
  userId,
  children,
}: Props) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const setIncomingCall = useChatStore((s) => s.setIncomingCall);

  // ── Tab title badge: (N) Board Name ───────────────────────────────────────
  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadNotificationCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(userId),
  });

  const notifCount = unreadData?.count ?? 0;

  useEffect(() => {
    // Small delay so Next.js finishes setting the new page title first on navigation
    const t = setTimeout(() => {
      const base = document.title.replace(/^\(\d+\)\s*/, "");
      document.title = notifCount > 0 ? `(${notifCount}) ${base}` : base;
    }, 50);
    return () => clearTimeout(t);
  }, [notifCount, pathname]);

  // Remove badge on unmount (logout / session end)
  useEffect(() => {
    return () => {
      document.title = document.title.replace(/^\(\d+\)\s*/, "");
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    console.log(
      "[SSE] Connecting notification stream for user:",
      userId,
    );

    const disconnect = connectNotificationStream(
      (notification: Notification) => {
        console.log("[SSE] New notification received:", notification);

        queryClient.setQueryData<{ count: number }>(
          ["notifications", "unread-count"],
          (oldData) => ({ count: (oldData?.count ?? 0) + 1 }),
        );

        queryClient.setQueryData<NotificationsResponse>(
          ["notifications", "list"],
          (oldData) => {
            if (!oldData) return oldData;
            const alreadyExists = oldData.data.some((item) => item.id === notification.id);
            if (alreadyExists) return oldData;
            return {
              ...oldData,
              data: [notification, ...oldData.data],
              meta: { ...oldData.meta, total: oldData.meta.total + 1 },
            };
          },
        );
      },
      undefined, // onFileImportProgress handled by ImportJobContext
      // board_update: automation moved a task — refetch the affected board
      ({ boardId }) => {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      },
      // boards_updated: a board was created/deleted — refetch boards list
      // and all open board detail queries so a deleted board shows 404 immediately
      () => {
        queryClient.invalidateQueries({ queryKey: ["boards"] });
        queryClient.invalidateQueries({ queryKey: ["board"] });
      },
      // chat_unread: new message in a channel the user isn't currently viewing
      (data: ChatUnreadEvent) => {
        incrementUnread(data.channelId);
      },
      // chat_call: someone started a call in a channel
      (data: ChatCallEvent) => {
        setIncomingCall(data);
      },
    );

    return () => {
      console.log(
        "[SSE] Disconnecting notification stream",
      );

      disconnect();
    };
  }, [userId, queryClient]);

  return <>{children}</>;
}