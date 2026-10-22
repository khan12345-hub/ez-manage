"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

import { connectNotificationStream, ChatUnreadEvent, ChatCallEvent } from "@/services/notifications.sse";
import { getUnreadNotificationCount } from "@/services/notifications.api";
import { useChatStore } from "@/store/chat-store";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";

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
  const { fire: fireDesktop } = useDesktopNotifications();

  // Keep latest callback refs so the SSE effect never needs to re-run when
  // these functions get new references (e.g. fireDesktop recreates on
  // permission change, Zustand selectors on store update). Without refs the
  // effect teardown+reconnect would fire on every render, causing the
  // rapid open/close cycles visible in server logs.
  const fireDesktopRef = useRef(fireDesktop);
  fireDesktopRef.current = fireDesktop;
  const incrementUnreadRef = useRef(incrementUnread);
  incrementUnreadRef.current = incrementUnread;
  const setIncomingCallRef = useRef(setIncomingCall);
  setIncomingCallRef.current = setIncomingCall;

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
    if (!userId) return;

    const disconnect = connectNotificationStream(
      (notification: Notification) => {
        const meta = notification.metadata as Record<string, any> | null | undefined;
        const url = meta?.workspaceId && meta?.boardId
          ? `/workspace/${meta.workspaceId}/board/${meta.boardId}`
          : undefined;
        fireDesktopRef.current(notification.title, notification.message, url);

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
      undefined,
      ({ boardId }) => {
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ["boards"] });
      },
      (data: ChatUnreadEvent) => {
        incrementUnreadRef.current(data.channelId);
      },
      (data: ChatCallEvent) => {
        setIncomingCallRef.current(data);
      },
      ({ boardId }: { boardId: number }) => {
        queryClient.invalidateQueries({ queryKey: ["board-tasks", Number(boardId)] });
      },
    );

    return () => disconnect();
  }, [userId, queryClient]); // queryClient is stable; userId changes only on login/logout

  return <>{children}</>;
}