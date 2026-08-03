"use client";

import React from "react";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { getUnreadNotificationCount } from "@/services/notifications.api";

export function Notifications() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "unread-count"],

    queryFn: getUnreadNotificationCount,

    // Keep the notification badge
    // reasonably fresh.
    refetchInterval: 30_000,

    // Don't refetch unnecessarily
    // between polling intervals.
    staleTime: 10_000,
  });

  const unreadCount = data?.count ?? 0;

  return (
    <button
      type="button"
      className="
     relative
     rounded-full
     p-1.5
     text-gray-500
     transition-colors
     hover:bg-gray-100
     hover:text-gray-800
   "
      aria-label={
        unreadCount > 0
          ? `${unreadCount} unread notifications`
          : "Notifications"
      }
    >
      {" "}
      <Bell className="h-5 w-5" />
      {!isLoading && unreadCount > 0 && (
        <span
          className="
          absolute
          right-1
          top-1
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
          text-white
          ring-2
          ring-white
        "
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
