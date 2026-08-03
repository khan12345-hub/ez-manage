

import { api } from "@/lib/api";
import {
  NotificationsResponse
} from "./notifications.types";

export async function getNotifications(
  page = 1,
  limit = 20,
): Promise<NotificationsResponse> {
  const response =
    await api.get<NotificationsResponse>(
      "/notifications",
      {
        params: {
          page,
          limit,
        },
      },
    );

  return response.data;
}

export async function getUnreadNotificationCount(): Promise<{
  count: number;
}> {
  const response =
    await api.get<{ count: number }>(
      "/notifications/unread-count",
    );

  return response.data;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<Notification> {
  const response =
    await api.patch<Notification>(
      `/notifications/${notificationId}/read`,
    );

  return response.data;
}

export async function markAllNotificationsAsRead(): Promise<{
  count: number;
}> {
  const response =
    await api.patch<{ count: number }>(
      "/notifications/read-all",
    );

  return response.data;
}

export async function deleteNotification(
  notificationId: number,
): Promise<{ success: boolean }> {
  const response =
    await api.delete<{
      success: boolean;
    }>(
      `/notifications/${notificationId}`,
    );

  return response.data;
}

