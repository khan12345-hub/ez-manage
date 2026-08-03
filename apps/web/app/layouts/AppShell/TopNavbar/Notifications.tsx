"use client";

import React from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/services/notifications.api";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Button } from "@/components/ui/button";
import { Notification } from "@/services/notifications.types";

export const notificationKeys = {
  all: ["notifications"] as const,

  list: ["notifications", "list"] as const,

  unreadCount: ["notifications", "unread-count"] as const,
};

function formatNotificationDate(date: string) {
  const notificationDate = new Date(date);

  const now = new Date();

  const diff = now.getTime() - notificationDate.getTime();

  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return notificationDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function Notifications() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);

  /*

* Unread count
  */
  const { data: unreadData } = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadNotificationCount,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  /*

* Notifications list
*
* Only fetch when dropdown opens.
  */
  const { data, isLoading, isFetching } = useQuery({
    queryKey: notificationKeys.list,

    queryFn: () => getNotifications(1, 20),

    enabled: open,

    staleTime: 30_000,
  });

  /*

* Mark one notification
* as read.
  */
  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.list,
      });

      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    },
  });

  /*

* Mark all notifications
* as read.
  */
  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.list,
      });

      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    },
  });

  const unreadCount = unreadData?.count ?? 0;

  console.log("[Notifications] unreadData:", unreadData);

  console.log("[Notifications] unreadCount:", unreadCount);

  const notifications = data?.data ?? [];

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/*
IMPORTANT:
Do NOT use asChild here.


    PopoverTrigger itself renders
    the button.
  */}
      <PopoverTrigger
        type="button"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        className="
      relative
      rounded-full
      p-1.5
      text-gray-500
      outline-none
      transition-colors
      hover:bg-gray-100
      hover:text-gray-800
      focus-visible:ring-2
      focus-visible:ring-gray-400
      focus-visible:ring-offset-2
    "
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span
            className="
          absolute
          right-0
          top-0
          flex
          h-4
          min-w-4
          items-center
          justify-center
          rounded-full
          bg-[#FF3D57]
          px-1
          text-[9px]
          font-bold
          leading-none
          text-white
          ring-2
          ring-white
        "
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="
      w-[380px]
      overflow-hidden
      rounded-xl
      border
      bg-white
      p-0
      shadow-xl
    "
      >
        {/* Header */}
        <div
          className="
        flex
        items-center
        justify-between
        border-b
        px-4
        py-3
      "
        >
          <div>
            <h3
              className="
            text-sm
            font-semibold
            text-gray-900
          "
            >
              Notifications
            </h3>

            {unreadCount > 0 && (
              <p
                className="
              mt-0.5
              text-xs
              text-gray-500
            "
              >
                {unreadCount} unread
              </p>
            )}
          </div>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="
            h-8
            gap-1.5
            text-xs
            text-gray-600
            hover:text-gray-900
          "
              disabled={markAllAsReadMutation.isPending}
              onClick={() => markAllAsReadMutation.mutate()}
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2
                  className="
                h-3.5
                w-3.5
                animate-spin
              "
                />
              ) : (
                <CheckCheck
                  className="
                h-3.5
                w-3.5
              "
                />
              )}
              Mark all as read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div
          className="
        max-h-[420px]
        overflow-y-auto
      "
        >
          {isLoading ? (
            <div
              className="
            flex
            h-32
            items-center
            justify-center
          "
            >
              <Loader2
                className="
              h-5
              w-5
              animate-spin
              text-gray-400
            "
              />
            </div>
          ) : notifications.length === 0 ? (
            <div
              className="
            flex
            h-36
            flex-col
            items-center
            justify-center
            px-4
            text-center
          "
            >
              <div
                className="
              mb-2
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              bg-gray-100
            "
              >
                <Bell
                  className="
                h-5
                w-5
                text-gray-400
              "
                />
              </div>

              <p
                className="
              text-sm
              font-medium
              text-gray-900
            "
              >
                No notifications
              </p>

              <p
                className="
              mt-1
              text-xs
              text-gray-500
            "
              >
                You're all caught up.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`
                flex
                w-full
                gap-3
                border-b
                px-4
                py-3
                text-left
                transition-colors
                hover:bg-gray-50
                ${!notification.isRead ? "bg-blue-50/40" : "bg-white"}
              `}
              >
                {/* Unread dot */}
                <div
                  className="
                  flex
                  w-2
                  shrink-0
                  justify-center
                  pt-1.5
                "
                >
                  <span
                    className={`
                    block
                    h-2
                    w-2
                    rounded-full
                    ${!notification.isRead ? "bg-[#FF3D57]" : "bg-transparent"}
                  `}
                  />
                </div>

                {/* Notification content */}
                <div
                  className="
                  min-w-0
                  flex-1
                "
                >
                  <div
                    className="
                    flex
                    items-start
                    justify-between
                    gap-3
                  "
                  >
                    <p
                      className={`
                      line-clamp-1
                      text-sm
                      text-gray-900
                      ${!notification.isRead ? "font-semibold" : "font-medium"}
                    `}
                    >
                      {notification.title}
                    </p>

                    <span
                      className="
                      shrink-0
                      whitespace-nowrap
                      text-[10px]
                      text-gray-400
                    "
                    >
                      {formatNotificationDate(notification.createdAt)}
                    </span>
                  </div>

                  <p
                    className="
                    mt-1
                    line-clamp-2
                    text-xs
                    leading-5
                    text-gray-500
                  "
                  >
                    {notification.message}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div
            className="
          border-t
          bg-gray-50/50
          p-2
        "
          >
            <Button
              type="button"
              variant="ghost"
              className="
            h-8
            w-full
            text-xs
            text-gray-600
          "
              onClick={() => {
                // Add your full notifications
                // page navigation here.
              }}
            >
              View all notifications
            </Button>
          </div>
        )}

        {isFetching && !isLoading && (
          <div
            className="
            absolute
            bottom-2
            right-2
          "
          >
            <Loader2
              className="
              h-3
              w-3
              animate-spin
              text-gray-400
            "
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
