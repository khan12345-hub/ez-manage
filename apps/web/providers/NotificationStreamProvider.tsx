"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { connectNotificationStream } from "@/services/notifications.sse";

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
        console.log(
          "[SSE] New notification received:",
          notification,
        );

        /**
         * Update unread count immediately.
         */
        queryClient.setQueryData<{ count: number }>(
          ["notifications", "unread-count"],
          (oldData) => {
            console.log(
              "[SSE] Previous unread count:",
              oldData,
            );

            return {
              count: (oldData?.count ?? 0) + 1,
            };
          },
        );

        /**
         * Update notification list immediately
         * if it already exists in React Query cache.
         */
        queryClient.setQueryData<NotificationsResponse>(
          ["notifications", "list"],
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            /**
             * Prevent duplicate notifications.
             */
            const alreadyExists = oldData.data.some(
              (item) => item.id === notification.id,
            );

            if (alreadyExists) {
              return oldData;
            }

            return {
              ...oldData,

              data: [
                notification,
                ...oldData.data,
              ],

              meta: {
                ...oldData.meta,
                total: oldData.meta.total + 1,
              },
            };
          },
        );
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