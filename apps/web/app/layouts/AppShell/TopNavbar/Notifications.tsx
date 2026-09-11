"use client";

import React from "react";
import {
  Bell,
  CheckCheck,
  Loader2,
  MoreHorizontal,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  deleteAllNotifications,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/services/notifications.api";

import { connectNotificationStream } from "@/services/notifications.sse";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Notification,
  NotificationType,
} from "@/services/notifications.types";
import { getBoardDetail } from "@/services/boards.api";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

async function getNotificationUrl(
  notification: Notification,
): Promise<string | null> {
  const { entityType, entityId, metadata } = notification;
  const meta = (metadata ?? {}) as Record<string, unknown>;

  try {
    if (entityType === "WORKSPACE" && entityId) {
      return `/workspace/${entityId}`;
    }

    if (entityType === "BOARD" && entityId) {
      const board = await getBoardDetail(entityId);
      const baseUrl = `/workspace/${board.workspaceId}/board/${entityId}`;
      const taskId = meta.taskId ? Number(meta.taskId) : null;
      return taskId ? `${baseUrl}?taskId=${taskId}` : baseUrl;
    }

    if (
      (entityType === "TASK" || entityType === "COMMENT") &&
      meta.boardId
    ) {
      const boardId = Number(meta.boardId);
      const board = await getBoardDetail(boardId);
      const baseUrl = `/workspace/${board.workspaceId}/board/${boardId}`;
      const taskId =
        entityType === "TASK" && entityId
          ? entityId
          : meta.taskId
            ? Number(meta.taskId)
            : null;
      return taskId ? `${baseUrl}?taskId=${taskId}` : baseUrl;
    }
  } catch {
    return null;
  }

  return null;
}

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

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return notificationDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/* Tab types                                                            */
/* ------------------------------------------------------------------ */

type Tab = "all" | "mentioned" | "assigned";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentioned", label: "Mentioned" },
  { id: "assigned", label: "Assigned to me" },
];

function applyFilters(
  notifications: Notification[],
  tab: Tab,
  search: string,
  unreadOnly: boolean,
): Notification[] {
  let list = notifications;

  if (tab === "mentioned") {
    list = list.filter(
      (n) => n.type === NotificationType.COMMENT_MENTION,
    );
  } else if (tab === "assigned") {
    list = list.filter(
      (n) => n.type === NotificationType.TASK_ASSIGNED,
    );
  }

  if (unreadOnly) {
    list = list.filter((n) => !n.isRead);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q),
    );
  }

  return list;
}

/* ------------------------------------------------------------------ */
/* Empty state illustration                                             */
/* ------------------------------------------------------------------ */

function EmptyIllustration() {
  return (
    <svg
      viewBox="0 0 220 190"
      className="w-48 h-40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* soft background circle */}
      <circle cx="110" cy="105" r="60" fill="#F0EDFF" />

      {/* Bell body */}
      <path
        d="M110 52 C90 52 74 68 74 88 L74 108 L66 116 L66 122 L154 122 L154 116 L146 108 L146 88 C146 68 130 52 110 52Z"
        fill="#6C5CE7"
      />
      {/* Bell clapper */}
      <ellipse cx="110" cy="124" rx="10" ry="6" fill="#6C5CE7" />
      {/* Bell shine */}
      <ellipse
        cx="94"
        cy="74"
        rx="5"
        ry="9"
        fill="white"
        opacity="0.25"
        transform="rotate(-20 94 74)"
      />

      {/* Check badge */}
      <circle cx="148" cy="64" r="14" fill="#00C875" />
      <path
        d="M141 64 L146 69 L155 59"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Floating shape – top left purple rect */}
      <rect
        x="28"
        y="36"
        width="20"
        height="20"
        rx="4"
        fill="#5034FF"
        transform="rotate(-18 28 36)"
      />

      {/* Floating shape – top right green diamond */}
      <rect
        x="165"
        y="22"
        width="18"
        height="18"
        rx="3"
        fill="#00C875"
        transform="rotate(22 165 22)"
      />

      {/* Floating shape – right orange circle */}
      <circle cx="182" cy="98" r="11" fill="#FF9500" />

      {/* Floating shape – left red rect */}
      <rect
        x="20"
        y="108"
        width="16"
        height="16"
        rx="3"
        fill="#FF3D57"
        transform="rotate(12 20 108)"
      />

      {/* Star sparkle – upper right */}
      <path
        d="M170 54 L172 60 L178 62 L172 64 L170 70 L168 64 L162 62 L168 60Z"
        fill="#FFD166"
      />

      {/* Star sparkle – left */}
      <path
        d="M42 82 L43.5 87 L48 88.5 L43.5 90 L42 95 L40.5 90 L36 88.5 L40.5 87Z"
        fill="#00C875"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export function Notifications() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  /* ---- queries ---- */
  const { data: unreadData } = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getUnreadNotificationCount,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => getNotifications(1, 50),
    enabled: open,
    staleTime: 0,
  });

  /* ---- invalidate unread count when panel opens ---- */
  React.useEffect(() => {
    if (open) {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    }
  }, [open, queryClient]);

  /* ---- SSE live updates ---- */
  React.useEffect(() => {
    const disconnect = connectNotificationStream(() => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.list,
      });
    });

    return disconnect;
  }, [queryClient]);

  /* ---- mutations ---- */
  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    },
  });

  /* ---- derived state ---- */
  const unreadCount = unreadData?.count ?? 0;
  const allNotifications = data?.data ?? [];
  const filtered = applyFilters(
    allNotifications,
    activeTab,
    search,
    unreadOnly,
  );

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    const url = await getNotificationUrl(notification);
    if (url) {
      setOpen(false);
      router.push(url);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* ---- Bell trigger ---- */}
      <PopoverTrigger
        type="button"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        className="relative cursor-pointer rounded-full p-1.5 text-gray-500 outline-none transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3D57] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      {/* ---- Panel ---- */}
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white p-0 shadow-2xl"
      >
        {/* === Header === */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Notifications
          </h2>

          <div className="flex items-center gap-1">
            {/* Settings → opens profile/notification settings */}
            <button
              type="button"
              title="Notification settings"
              onClick={() => {
                setOpen(false);
                router.push("/settings");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* More options dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="More options"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  disabled={
                    unreadCount === 0 ||
                    markAllAsReadMutation.isPending
                  }
                  onClick={() => markAllAsReadMutation.mutate()}
                >
                  {markAllAsReadMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="mr-2 h-4 w-4" />
                  )}
                  Mark all as read
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={
                    allNotifications.length === 0 ||
                    deleteAllMutation.isPending
                  }
                  className="text-destructive focus:text-destructive"
                  onClick={() => deleteAllMutation.mutate()}
                >
                  {deleteAllMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close */}
            <button
              type="button"
              title="Close"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* === Tabs === */}
        <div className="flex border-b border-gray-200 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative mr-4 pb-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-[#0073EA]"
                  : "text-gray-500 hover:text-gray-800",
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0073EA]" />
              )}
            </button>
          ))}
        </div>

        {/* === Search + Unread toggle === */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications by people, boards, and more..."
              className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#0073EA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0073EA]/20 transition"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Switch
              id="unread-only"
              checked={unreadOnly}
              onCheckedChange={setUnreadOnly}
              className="data-[state=checked]:bg-[#0073EA] scale-90"
            />
            <label
              htmlFor="unread-only"
              className="cursor-pointer select-none text-xs font-medium text-gray-600 whitespace-nowrap"
            >
              Unread only
            </label>
          </div>
        </div>

        {/* === Notification list === */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <EmptyIllustration />
              <p className="mt-4 text-base font-bold text-gray-900">
                You rock!
              </p>
              <p className="mt-1 text-sm text-[#d83a52]">
                No new notifications, for now. Go ahead and take a
                break.
              </p>
            </div>
          ) : (
            filtered.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() =>
                  handleNotificationClick(notification)
                }
                className={cn(
                  "flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                  !notification.isRead && "bg-blue-50/50",
                )}
              >
                {/* Unread dot */}
                <div className="flex w-2.5 shrink-0 items-start pt-1.5">
                  <span
                    className={cn(
                      "block h-2 w-2 rounded-full",
                      !notification.isRead
                        ? "bg-[#0073EA]"
                        : "bg-transparent",
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={cn(
                        "line-clamp-1 text-sm text-gray-900",
                        !notification.isRead
                          ? "font-semibold"
                          : "font-medium",
                      )}
                    >
                      {notification.title}
                    </p>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-gray-400">
                      {formatNotificationDate(
                        notification.createdAt,
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-gray-500">
                    {notification.message}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Subtle refresh indicator */}
        {isFetching && !isLoading && (
          <div className="absolute bottom-2 right-2">
            <Loader2 className="h-3 w-3 animate-spin text-gray-300" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
