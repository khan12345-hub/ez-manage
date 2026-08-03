"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { connectNotificationStream } from "@/services/notifications.sse";
import { notificationKeys } from "@/services/notification.keys";

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
      "[SSE] Connecting for user:",
      userId,
    );

    const disconnect =
      connectNotificationStream(
        (notification) => {
          console.log(
            "[SSE] Received:",
            notification,
          );

          // Get current unread count
          const current =
            queryClient.getQueryData<{
              count: number;
            }>(
              notificationKeys.unreadCount,
            );

          console.log(
            "[SSE] Current unread cache:",
            current,
          );

          // Update unread count immediately
          queryClient.setQueryData<{
            count: number;
          }>(
            notificationKeys.unreadCount,
            {
              count:
                (current?.count ?? 0) + 1,
            },
          );

          console.log(
            "[SSE] Updated unread cache:",
            queryClient.getQueryData(
              notificationKeys.unreadCount,
            ),
          );

          // If notification dropdown is already loaded,
          // add the new notification to the top.
          queryClient.setQueryData(
            notificationKeys.list,
            (oldData: any) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                data: [
                  notification,
                  ...(oldData.data ?? []),
                ],
              };
            },
          );
        },
      );

    return () => {
      console.log(
        "[SSE] Disconnecting",
      );

      disconnect();
    };
  }, [
    userId,
    queryClient,
  ]);

  return <>{children}</>;
}