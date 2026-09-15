"use client";

import { useState, useRef, useCallback } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  X,
  Search,
  RefreshCw,
  FilePlus,
  FileX,
  MessageSquare,
  UserPlus,
  UserMinus,
  Pencil,
  Trash2,
  Plus,
  Copy,
  MoveRight,
  RotateCcw,
  Activity,
  Clock,
} from "lucide-react";

import { getBoardActivities, getBoardViews, TaskActivity, BoardViewEntry } from "@/services/activity-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  board: any;
  open: boolean;
  onClose: () => void;
}

type Tab = "activity" | "lastviewed";

const ACTION_ICON: Record<string, React.ReactNode> = {
  CREATED:         <Plus       className="h-3.5 w-3.5 text-green-500" />,
  UPDATED:         <Pencil     className="h-3.5 w-3.5 text-blue-500" />,
  DELETED:         <Trash2     className="h-3.5 w-3.5 text-red-500" />,
  RESTORED:        <RotateCcw  className="h-3.5 w-3.5 text-amber-500" />,
  MOVED:           <MoveRight  className="h-3.5 w-3.5 text-purple-500" />,
  REORDERED:       <MoveRight  className="h-3.5 w-3.5 text-purple-400" />,
  ASSIGNED:        <UserPlus   className="h-3.5 w-3.5 text-green-500" />,
  UNASSIGNED:      <UserMinus  className="h-3.5 w-3.5 text-orange-500" />,
  STATUS_CHANGED:  <RefreshCw  className="h-3.5 w-3.5 text-blue-500" />,
  FILE_ADDED:      <FilePlus   className="h-3.5 w-3.5 text-green-500" />,
  FILE_DELETED:    <FileX      className="h-3.5 w-3.5 text-red-500" />,
  COMMENT_ADDED:   <MessageSquare className="h-3.5 w-3.5 text-blue-400" />,
  COMMENT_UPDATED: <MessageSquare className="h-3.5 w-3.5 text-blue-400" />,
  COMMENT_DELETED: <MessageSquare className="h-3.5 w-3.5 text-red-400" />,
  REPLY_ADDED:     <MessageSquare className="h-3.5 w-3.5 text-blue-300" />,
  MEMBER_ADDED:    <UserPlus   className="h-3.5 w-3.5 text-green-500" />,
  MEMBER_REMOVED:  <UserMinus  className="h-3.5 w-3.5 text-red-500" />,
};

const ACTION_LABEL: Record<string, string> = {
  CREATED:         "Created",
  UPDATED:         "Updated",
  DELETED:         "Deleted",
  RESTORED:        "Restored",
  MOVED:           "Moved",
  REORDERED:       "Reordered",
  ASSIGNED:        "Assigned",
  UNASSIGNED:      "Unassigned",
  STATUS_CHANGED:  "Status changed",
  FILE_ADDED:      "Files",
  FILE_DELETED:    "Files",
  COMMENT_ADDED:   "Comment",
  COMMENT_UPDATED: "Comment",
  COMMENT_DELETED: "Comment",
  REPLY_ADDED:     "Reply",
  MEMBER_ADDED:    "Member added",
  MEMBER_REMOVED:  "Member removed",
};

function getActionDetail(a: TaskActivity): string {
  const m = a.metadata;
  if (!m) return "";
  if (a.action === "STATUS_CHANGED") {
    return m.newLabel ? `→ ${m.newLabel}` : "";
  }
  if (a.action === "FILE_ADDED" || a.action === "FILE_DELETED") {
    const name = m.fileName as string | undefined;
    return name ? `Added ${name.length > 14 ? name.slice(0, 14) + "…" : name}` : "";
  }
  if (a.action === "UPDATED" && m.columnName) {
    return String(m.columnName);
  }
  if ((a.action === "ASSIGNED" || a.action === "UNASSIGNED") && m.memberName) {
    return String(m.memberName);
  }
  return "";
}

function Avatar({ user }: { user: TaskActivity["user"] }) {
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const colors = ["bg-orange-500","bg-blue-500","bg-green-500","bg-purple-500","bg-rose-500"];
  const color = colors[user.id % colors.length];

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={initials}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${color}`}>
      {initials}
    </div>
  );
}

function ActivityRow({ item }: { item: TaskActivity }) {
  const label = item.task?.name ?? item.group?.name ?? "";
  const detail = getActionDetail(item);
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: false });
  const shortTime = timeAgo
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d")
    .replace(" months", "M").replace(" month", "M")
    .replace(" years", "y").replace(" year", "y")
    .replace("about ", "").replace("less than a", "<1").trim();

  return (
    <div className="flex gap-2.5 border-b px-4 py-3 hover:bg-muted/40 transition-colors">
      <span className="mt-0.5 w-7 shrink-0 text-right text-[11px] text-muted-foreground">
        {shortTime}
      </span>
      <Avatar user={item.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate max-w-[120px]" title={label}>
            {label || item.user.firstName}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {ACTION_ICON[item.action]}
            {ACTION_LABEL[item.action] ?? item.action}
          </span>
          {detail && (
            <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={detail}>
              {detail}
            </span>
          )}
        </div>
        {item.group && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Group: <span className="text-primary">{item.group.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function UserAvatar({ user }: { user: BoardViewEntry["user"] }) {
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const colors = ["bg-orange-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-rose-500"];
  const color = colors[user.id % colors.length];
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={initials} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${color}`}>
      {initials}
    </div>
  );
}

function LastViewedTab({ boardId, open }: { boardId?: number; open: boolean }) {
  const { data: views = [], isLoading, refetch } = useQuery({
    queryKey: ["board-views", boardId],
    queryFn: () => getBoardViews(boardId!),
    enabled: !!boardId && open,
    staleTime: 30_000,
  });

  const now = new Date();

  const formatWhen = (viewedAt: string) => {
    const d = new Date(viewedAt);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(d, "MMM d, yyyy");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-xs text-muted-foreground">{views.length} member{views.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : views.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Clock className="h-8 w-8 opacity-30" />
            <p className="text-sm">No views recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {views.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <UserAvatar user={v.user} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {v.user.firstName} {v.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last viewed {formatWhen(v.viewedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(v.viewedAt), "h:mm a")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BoardActivityPanel({ board, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("activity");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);

  const toggleUser = (userId: number) =>
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );

  // board.members shape: { id, role, userId, user: { id, firstName, lastName, avatarUrl } }
  const members: { userId: number; user: { id: number; firstName: string; lastName: string; avatarUrl?: string | null } }[] =
    board?.members ?? [];
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 400);
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ["board-activity", board?.id, debouncedSearch, selectedUserIds],
      queryFn: ({ pageParam }) =>
        getBoardActivities(board.id, {
          cursor: pageParam as string | undefined,
          search: debouncedSearch || undefined,
          userIds: selectedUserIds.length ? selectedUserIds.join(",") : undefined,
          limit: 30,
        }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
      enabled: !!board?.id && open && tab === "activity",
    });

  const allItems = data?.pages.flatMap((p) => p.data) ?? [];

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });
      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">
            {board?.name} <span className="text-muted-foreground font-normal">Log</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5">
          {(["activity", "lastviewed"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative mr-4 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "activity" ? "Activity" : "Last Viewed"}
            </button>
          ))}
        </div>

        {/* Activity tab */}
        {tab === "activity" && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>

              {/* Person filter button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPersonPickerOpen((v) => !v)}
                  className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                    selectedUserIds.length
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Person
                  {selectedUserIds.length > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                      {selectedUserIds.length}
                    </span>
                  )}
                </button>

                {personPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setPersonPickerOpen(false)} />
                    <div className="absolute right-0 top-10 z-[61] min-w-[220px] rounded-md border bg-background p-3 shadow-lg">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Filter by person</p>
                      <div className="flex flex-wrap gap-2">
                        {members.map((m) => {
                          const isSelected = selectedUserIds.includes(m.userId);
                          const initials = `${m.user.firstName?.[0] ?? ""}${m.user.lastName?.[0] ?? ""}`.toUpperCase();
                          const colors = ["bg-orange-500","bg-blue-500","bg-green-500","bg-purple-500","bg-rose-500"];
                          const color = colors[m.userId % colors.length];
                          return (
                            <button
                              key={m.userId}
                              type="button"
                              title={`${m.user.firstName} ${m.user.lastName}`}
                              onClick={() => toggleUser(m.userId)}
                              className={`relative flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 transition-all ${
                                isSelected
                                  ? "ring-primary ring-offset-2"
                                  : "ring-transparent hover:ring-muted-foreground/40"
                              } ${!m.user.avatarUrl ? color : ""}`}
                            >
                              {m.user.avatarUrl ? (
                                <img
                                  src={m.user.avatarUrl}
                                  alt={initials}
                                  className="h-9 w-9 rounded-full object-cover"
                                />
                              ) : (
                                initials
                              )}
                              {isSelected && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-white">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedUserIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedUserIds([])}
                          className="mt-3 w-full rounded-md border border-dashed py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                        >
                          Clear filter
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => refetch()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col gap-3 p-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : allItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Activity className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No activity yet.</p>
                </div>
              ) : (
                <>
                  {allItems.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                  <div ref={loadMoreRef} className="py-3 text-center">
                    {isFetchingNextPage && (
                      <span className="text-xs text-muted-foreground">Loading more…</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Last Viewed tab */}
        {tab === "lastviewed" && (
          <LastViewedTab boardId={board?.id} open={open} />
        )}
      </div>
    </>
  );
}
