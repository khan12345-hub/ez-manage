"use client";

import React, { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  X, ChevronLeft, MessageSquare, Smile, Mail, Phone, Users, UserX,
  Loader2, ChevronDown, ChevronRight, Calendar, Check, Trash2, Activity,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getMemberTasks, getMemberActivity, updateTaskCell, deleteTask,
} from "@/services/tasks.api";
import type { AssignedTask, ActivityItem } from "@/services/tasks.api";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";
const av = (url?: string | null) => (url ? `${BASE_URL}${url}` : undefined);

function formatLastSeen(iso: string | null | undefined) {
  if (!iso) return "Never logged in";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatJoined(iso: string | undefined | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatDue(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") {
    try { return walkNode(JSON.parse(content)); } catch { return stripHtml(content); }
  }
  return walkNode(content);
}

function walkNode(node: any): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) return node.content.map(walkNode).join("");
  return "";
}

function formatLogValue(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val || null;
  if (typeof val === "number") return String(val);
  // Date object or ISO string stored as object
  if (val instanceof Date) return val.toLocaleDateString();
  if (typeof val === "object") {
    // Person/user object
    if (val.firstName || val.lastName)
      return `${val.firstName ?? ""} ${val.lastName ?? ""}`.trim();
    // Status object with label
    if (val.label) return val.label;
    // Date ISO string in an object key
    if (val.date) return new Date(val.date).toLocaleDateString();
    if (val.value) return String(val.value);
    // Array of users
    if (Array.isArray(val))
      return val.map((v) => formatLogValue(v)).filter(Boolean).join(", ") || null;
  }
  return null;
}

function describeLog(item: ActivityItem): string | null {
  const m = item.metadata as any;
  switch (item.action) {
    case "CREATED": return "Created task";
    case "UPDATED": {
      const val = formatLogValue(m?.newValue);
      if (m?.columnName) return `Changed ${m.columnName}${val ? ` → "${val}"` : ""}`;
      if (m?.newName) return `Renamed to "${m.newName}"`;
      return "Updated task";
    }
    case "STATUS_CHANGED": {
      const val = formatLogValue(m?.newValue);
      return `Changed status${val ? ` → "${val}"` : ""}`;
    }
    case "ASSIGNED": return "Was assigned to task";
    case "UNASSIGNED": return "Was unassigned from task";
    case "COMMENT_ADDED": return m?.preview ? `Commented: "${m.preview.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}"` : "Added a comment";
    case "COMMENT_UPDATED": return "Edited a comment";
    case "REPLY_ADDED": return "Replied to a comment";
    case "FILE_ADDED": return m?.fileName ? `Added file: ${m.fileName}` : "Added a file";
    case "FILE_DELETED": return "Removed a file";
    case "MOVED": return "Moved task";
    case "DELETED": return "Deleted task";
    case "MEMBER_ADDED": return "Joined the board";
    case "MEMBER_REMOVED": return "Left the board";
    default: return item.action?.replace(/_/g, " ").toLowerCase() ?? null;
  }
}

function groupReactions(reactions: { emoji: string; userId: number }[]) {
  const map = new Map<string, number>();
  for (const r of reactions) map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
  return Array.from(map.entries()).map(([emoji, count]) => ({ emoji, count }));
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-xs font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

const PRESET_STATUSES = [
  { emoji: "🗓️", text: "In a meeting" },
  { emoji: "🏖️", text: "On vacation" },
  { emoji: "🤒", text: "Out sick" },
  { emoji: "🏠", text: "Working from home" },
  { emoji: "🎯", text: "Focusing" },
  { emoji: "🚫", text: "Do not disturb" },
] as const;

// ── TaskHoverCard rendered via portal ────────────────────────────────────────
function TaskHoverCard({ task, rect }: { task: AssignedTask; rect: DOMRect }) {
  const W = 224;
  const left = rect.left - W - 8 > 0 ? rect.left - W - 8 : rect.right + 8;
  const top = Math.min(rect.top, (typeof window !== "undefined" ? window.innerHeight : 800) - 200);

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
      style={{ top, left, width: W }}
    >
      <p className="mb-0.5 line-clamp-2 text-xs font-semibold text-slate-800">{task.name}</p>
      <p className="mb-2 text-[10px] text-slate-400">
        {task.boardName} / {task.groupName}
      </p>

      {task.statusLabel && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ backgroundColor: task.statusColor ?? "#94a3b8" }}
          />
          <span className="text-[11px] text-slate-600">{task.statusLabel}</span>
        </div>
      )}

      {task.dueDate && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="text-[11px] text-slate-600">{formatDue(task.dueDate)}</span>
        </div>
      )}

      {task.assignedUsers.length > 0 && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {task.assignedUsers.slice(0, 4).map((u) => (
              <Avatar key={u.id} className="h-5 w-5 ring-1 ring-white">
                <AvatarImage src={av(u.avatarUrl)} />
                <AvatarFallback className="bg-indigo-100 text-[8px] text-indigo-700">
                  {u.firstName[0]}{u.lastName[0]}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="truncate text-[10px] text-slate-500">
            {task.assignedUsers.slice(0, 2).map((u) => u.firstName).join(", ")}
            {task.assignedUsers.length > 2 && ` +${task.assignedUsers.length - 2}`}
          </span>
        </div>
      )}

      <p className="mt-1 text-[10px] text-slate-300">
        Created by {task.createdBy.firstName} {task.createdBy.lastName}
      </p>
    </div>,
    document.body,
  );
}

// ── TaskRow ──────────────────────────────────────────────────────────────────
interface TaskRowProps {
  task: AssignedTask;
  isOverdue: boolean;
  workspaceId: number;
  onRefetch: () => void;
}

function TaskRow({ task, isOverdue, workspaceId, onRefetch }: TaskRowProps) {
  const router = useRouter();
  const rowRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const isDone =
    task.statusLabel != null && /done|complete|finish|closed/i.test(task.statusLabel);

  const handleMouseEnter = () => {
    setHover(true);
    hoverTimer.current = setTimeout(() => {
      if (rowRef.current) setCardRect(rowRef.current.getBoundingClientRect());
    }, 500);
  };

  const handleMouseLeave = () => {
    setHover(false);
    setCardRect(null);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try { await deleteTask(task.id, task.boardId); onRefetch(); } catch { setDeleting(false); }
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (completing || !task.statusCellId) return;
    const doneOpt = (task.statusOptions as any[]).find((o) =>
      /done|complete|finish|closed/i.test(o.label),
    );
    if (!doneOpt) return;
    setCompleting(true);
    try {
      await updateTaskCell(task.boardId, task.statusCellId, {
        id: doneOpt.id, label: doneOpt.label, color: doneOpt.color,
      });
      onRefetch();
    } catch {}
    setCompleting(false);
  };

  return (
    <div
      ref={rowRef}
      className="relative flex cursor-pointer items-start gap-2 px-4 py-2.5 transition-colors hover:bg-slate-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => router.push(`/workspace/${workspaceId}/board/${task.boardId}?taskId=${task.id}`)}
    >
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2"
        style={{
          borderColor: task.statusColor ?? "#cbd5e1",
          backgroundColor: task.statusColor ? `${task.statusColor}33` : "transparent",
        }}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-medium ${isDone ? "text-slate-400 line-through" : "text-slate-700"}`}>
          {task.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {task.dueDate && (
            <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
              <Calendar className="h-2.5 w-2.5" />
              {formatDue(task.dueDate)}
            </span>
          )}
          <span className="truncate text-[10px] text-slate-300">{task.boardName}</span>
        </div>
      </div>

      {hover && (
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {task.statusCellId && !isDone && (
            <button
              title="Mark done"
              onClick={handleComplete}
              disabled={completing}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-green-50 hover:text-green-600"
            >
              {completing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Check className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            title="Delete task"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            {deleting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {cardRect && <TaskHoverCard task={task} rect={cardRect} />}
    </div>
  );
}

// ── MentionBadge — hoverable @mention in activity comments ───────────────────
function MentionBadge({
  mention,
  workspaceId,
  inline = false,
}: {
  mention: { user: { id: number; firstName: string; lastName: string; avatarUrl: string | null } };
  workspaceId: number;
  inline?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setCardPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen(true);
  };

  const hide = () => {
    hideTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const keepOpen = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  return (
    <span
      ref={ref}
      className={inline
        ? "cursor-pointer rounded px-0.5 font-semibold text-indigo-600 hover:bg-indigo-50"
        : "relative inline-flex cursor-default items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      @{mention.user.firstName} {mention.user.lastName}

      {open && cardPos &&
        createPortal(
          <div
            className="fixed z-[9999] w-52 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
            style={{ top: cardPos.top, left: cardPos.left }}
            onMouseEnter={keepOpen}
            onMouseLeave={hide}
          >
            {/* gradient header */}
            <div className="h-10 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
            <div className="-mt-6 flex flex-col items-center px-3 pb-3">
              <div className="relative">
                <Avatar className="h-12 w-12 ring-2 ring-white shadow">
                  <AvatarImage src={av(mention.user.avatarUrl)} />
                  <AvatarFallback className="bg-indigo-100 text-sm font-bold text-indigo-700">
                    {mention.user.firstName[0]}{mention.user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="mt-1.5 text-center text-xs font-bold text-slate-800">
                {mention.user.firstName} {mention.user.lastName}
              </p>
              <div className="mt-2 flex w-full gap-1.5">
                <button
                  onClick={() => router.push(`/workspace/${workspaceId}/chat`)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <MessageSquare className="h-3 w-3" /> Chat
                </button>
                <button
                  onClick={() => router.push(`/workspace/${workspaceId}/members`)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Profile
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

// ── ActivityTaskLink — hoverable task title in activity items ─────────────────
type ActivityTask = { id: number; name: string; group: { name: string; board: { id: number; name: string } } };

function ActivityTaskLink({ task, workspaceId }: { task: ActivityTask; workspaceId: number }) {
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCard = () => {
    hoverTimer.current = setTimeout(() => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setCardPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 220) });
      }
    }, 350);
  };
  const hideCard = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setCardPos(null);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => router.push(`/workspace/${workspaceId}/board/${task.group.board.id}?taskId=${task.id}`)}
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        className="flex items-center gap-1.5 text-left"
      >
        <span className="h-2 w-2 shrink-0 rounded-sm bg-indigo-500" />
        <span className="truncate text-[11px] font-semibold text-indigo-600 underline-offset-2 hover:underline">
          {task.name}
        </span>
      </button>
      {cardPos && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          style={{ top: cardPos.top, left: cardPos.left }}
        >
          <p className="mb-0.5 line-clamp-2 text-xs font-semibold text-slate-800">{task.name}</p>
          <p className="text-[10px] text-slate-400">{task.group.board.name} › {task.group.name}</p>
          <p className="mt-2 text-[10px] font-medium text-indigo-500">Click to open task →</p>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── InlineMentionText — comment text with colored, hoverable @mentions ─────────
function InlineMentionText({
  text,
  mentions,
  workspaceId,
}: {
  text: string;
  mentions: { user: { id: number; firstName: string; lastName: string; avatarUrl: string | null } }[];
  workspaceId: number;
}) {
  if (!text) return null;
  if (!mentions.length || !text.includes("@")) {
    return <span className="text-[11px] leading-relaxed text-slate-600">{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const re = /@([A-Za-z]+(?:\s[A-Za-z]+)?)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    const found = mentions.find((mn) => {
      const full = `${mn.user.firstName} ${mn.user.lastName}`.toLowerCase();
      return full === name || mn.user.firstName.toLowerCase() === name;
    });
    if (found) {
      if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
      parts.push(
        <MentionBadge key={`${found.user.id}-${m.index}`} mention={found} workspaceId={workspaceId} inline />,
      );
      lastIndex = m.index + m[0].length;
    }
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <span className="text-[11px] leading-relaxed text-slate-600">{parts}</span>;
}

// ── CommentActivityItem ───────────────────────────────────────────────────────
function CommentActivityItem({ item, workspaceId }: { item: ActivityItem; workspaceId: number }) {
  const text = extractText(item.content);
  const reactions = item.reactions ?? [];
  const mentions = item.mentions ?? [];
  const grouped = groupReactions(reactions);

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
      {item.task && (
        <div className="mb-1.5">
          <ActivityTaskLink task={item.task} workspaceId={workspaceId} />
          <p className="mt-0.5 text-[10px] text-slate-400">
            {item.task.group.board.name} › {item.task.group.name}
          </p>
        </div>
      )}
      <div className="line-clamp-3">
        <InlineMentionText text={text} mentions={mentions} workspaceId={workspaceId} />
      </div>
      {grouped.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {grouped.map((r) => (
            <span
              key={r.emoji}
              className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]"
            >
              {r.emoji} {r.count}
            </span>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-right text-[10px] text-slate-300">{formatRelTime(item.createdAt)}</p>
    </div>
  );
}

// ── LogActivityItem ───────────────────────────────────────────────────────────
function LogActivityItem({ item, workspaceId }: { item: ActivityItem; workspaceId: number }) {
  const desc = describeLog(item);
  if (!desc) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
        <Activity className="h-2.5 w-2.5 text-slate-400" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-600">{desc}</p>
        {item.task && (
          <div className="mt-0.5">
            <ActivityTaskLink task={item.task} workspaceId={workspaceId} />
          </div>
        )}
      </div>
      <p className="shrink-0 text-[10px] text-slate-300">{formatRelTime(item.createdAt)}</p>
    </div>
  );
}

// ── ActivityFeed ──────────────────────────────────────────────────────────────
function ActivityFeed({ workspaceId, userId, enabled }: {
  workspaceId: number;
  userId: number;
  enabled: boolean;
}) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["member-activity", workspaceId, userId],
    queryFn: () => getMemberActivity(workspaceId, userId),
    enabled,
    staleTime: 30_000,
  });

  const grouped = useMemo(() => {
    if (!items.length) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const groups: { label: string; items: ActivityItem[] }[] = [];
    for (const item of items) {
      const d = new Date(item.createdAt); d.setHours(0, 0, 0, 0);
      const label =
        d.getTime() === today.getTime() ? "Today"
        : d.getTime() === yesterday.getTime() ? "Yesterday"
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Activity className="h-8 w-8 text-slate-200" />
        <p className="text-xs text-slate-400">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {grouped.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {g.label}
          </p>
          <div className="flex flex-col gap-2">
            {g.items.map((item) =>
              item.kind === "comment"
                ? <CommentActivityItem key={`c-${item.id}`} item={item} workspaceId={workspaceId} />
                : <LogActivityItem key={`l-${item.id}`} item={item} workspaceId={workspaceId} />,
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Interfaces ────────────────────────────────────────────────────────────────
export interface UserProfilePanelUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface UserProfilePanelFullUser {
  email?: string | null;
  phone?: string | null;
  whatsappPhone?: string | null;
  whatsappEnabled?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

export interface UserProfilePanelProps {
  user: UserProfilePanelUser;
  fullUser?: UserProfilePanelFullUser;
  isOnline: boolean;
  isCurrentUser: boolean;
  workspaceId: number;
  statusEmoji?: string | null;
  statusText?: string | null;
  onBack?: () => void;
  onClose: () => void;
  onSendMessage?: () => void;
  onRemove?: () => void;
  onSetStatus?: (emoji: string | null, text: string | null) => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function UserProfilePanel({
  user,
  fullUser,
  isOnline,
  isCurrentUser,
  workspaceId,
  statusEmoji,
  statusText,
  onBack,
  onClose,
  onSendMessage,
  onRemove,
  onSetStatus,
}: UserProfilePanelProps) {
  const qc = useQueryClient();
  const [profileTab, setProfileTab] = useState<"info" | "task" | "activity">("info");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    overdue: true, today: true, next: true,
  });

  const { data: assignedTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["member-tasks", workspaceId, user.id],
    queryFn: () => getMemberTasks(workspaceId, user.id),
    enabled: profileTab === "task",
    staleTime: 30_000,
  });

  const taskGroups = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const isDone = (t: AssignedTask) =>
      t.statusLabel != null && /done|complete|finish|closed/i.test(t.statusLabel);
    const groups: { key: string; label: string; tasks: AssignedTask[] }[] = [
      { key: "overdue", label: "Overdue", tasks: [] },
      { key: "today",   label: "Today",   tasks: [] },
      { key: "next",    label: "Next",    tasks: [] },
      { key: "unscheduled", label: "Unscheduled", tasks: [] },
      { key: "done",    label: "Done",    tasks: [] },
    ];
    for (const t of assignedTasks) {
      if (isDone(t)) { groups[4]!.tasks.push(t); continue; }
      if (!t.dueDate) { groups[3]!.tasks.push(t); continue; }
      const due = new Date(t.dueDate); due.setHours(0, 0, 0, 0);
      if (due < today)        groups[0]!.tasks.push(t);
      else if (due < tomorrow) groups[1]!.tasks.push(t);
      else                    groups[2]!.tasks.push(t);
    }
    return groups;
  }, [assignedTasks]);

  const totalTasks = assignedTasks.length;
  const refetchTasks = () => qc.invalidateQueries({ queryKey: ["member-tasks", workspaceId, user.id] });

  const [showStatusEdit, setShowStatusEdit] = useState(false);
  const [editEmoji, setEditEmoji] = useState(statusEmoji ?? "");
  const [editText, setEditText] = useState(statusText ?? "");
  const [savingStatus, setSavingStatus] = useState(false);

  async function handleSaveStatus() {
    if (!onSetStatus) return;
    setSavingStatus(true);
    await onSetStatus(editEmoji || null, editText || null);
    setSavingStatus(false);
    setShowStatusEdit(false);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top nav */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        {onBack && (
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs font-semibold text-slate-700">Profile</span>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Cover + avatar */}
      <div className="shrink-0">
        <div className="h-16 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
        <div className="-mt-8 flex flex-col items-center px-4 pb-4">
          <div className="relative">
            <Avatar className="h-16 w-16 shadow-md ring-2 ring-white">
              <AvatarImage src={av(user.avatarUrl)} />
              <AvatarFallback className="bg-indigo-100 text-xl font-bold text-indigo-700">
                {user.firstName[0]}{user.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white ${
                isOnline ? "bg-green-500" : "bg-slate-300"
              }`}
            />
          </div>
          <p className="mt-2 text-center text-sm font-bold leading-tight text-slate-800">
            {user.firstName} {user.lastName}
            {isCurrentUser && <span className="ml-1 text-[10px] font-normal text-slate-400">(you)</span>}
          </p>
          {(statusEmoji || statusText) && (
            <p className="text-center text-xs text-slate-500">{statusEmoji} {statusText}</p>
          )}
          <p className={`mt-0.5 text-[11px] font-semibold ${isOnline ? "text-green-500" : "text-slate-400"}`}>
            {isOnline ? "● Online" : "○ Offline"}
          </p>

          {isCurrentUser && (
            <button
              onClick={() => { setEditEmoji(statusEmoji ?? ""); setEditText(statusText ?? ""); setShowStatusEdit((v) => !v); }}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Smile className="h-3 w-3" />
              {statusText ? "Update status" : "Set a status"}
            </button>
          )}

          {!isCurrentUser && (
            <div className="mt-3 flex gap-2">
              {onSendMessage && (
                <button
                  onClick={onSendMessage}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                  <MessageSquare className="h-3 w-3" /> Message
                </button>
              )}
              {fullUser?.whatsappEnabled && fullUser?.whatsappPhone && (
                <a
                  href={`https://wa.me/${fullUser.whatsappPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-600"
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-slate-100">
        {(["info", "task", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setProfileTab(t)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              profileTab === t
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t === "info" ? "Info"
              : t === "task" ? `Tasks${totalTasks > 0 ? ` (${totalTasks})` : ""}`
              : "Activity"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* Info tab */}
        {profileTab === "info" && (
          <div className="flex flex-col gap-0 divide-y divide-slate-50 px-4 py-3">
            {fullUser?.email && (
              <InfoRow icon={<Mail className="h-3.5 w-3.5 text-slate-400" />} label="Email" value={fullUser.email} />
            )}
            {fullUser?.phone && (
              <InfoRow icon={<Phone className="h-3.5 w-3.5 text-slate-400" />} label="Phone" value={fullUser.phone} />
            )}
            <InfoRow
              icon={<Users className="h-3.5 w-3.5 text-slate-400" />}
              label="Last active"
              value={isOnline ? "Online now" : formatLastSeen(fullUser?.lastLoginAt)}
            />
            {fullUser?.createdAt && (
              <InfoRow
                icon={<Calendar className="h-3.5 w-3.5 text-slate-400" />}
                label="Member since"
                value={formatJoined(fullUser.createdAt)}
              />
            )}
            {!isCurrentUser && onRemove && (
              <div className="pt-4">
                <button
                  onClick={onRemove}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
                >
                  <UserX className="h-3.5 w-3.5" /> Remove from channel
                </button>
              </div>
            )}
            {isCurrentUser && showStatusEdit && (
              <div className="mt-2 border-t border-slate-100 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Set status</p>
                <div className="mb-2 grid grid-cols-2 gap-1">
                  {PRESET_STATUSES.map((p) => (
                    <button
                      key={p.text}
                      onClick={() => { setEditEmoji(p.emoji); setEditText(p.text); }}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                        editEmoji === p.emoji && editText === p.text
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{p.emoji}</span>
                      <span className="truncate">{p.text}</span>
                    </button>
                  ))}
                </div>
                <div className="mb-2 flex gap-1">
                  <input
                    value={editEmoji} onChange={(e) => setEditEmoji(e.target.value)}
                    placeholder="😊" maxLength={2}
                    className="w-9 rounded border border-slate-200 px-1 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <input
                    value={editText} onChange={(e) => setEditText(e.target.value)}
                    placeholder="What's your status?" maxLength={100}
                    className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { if (onSetStatus) onSetStatus(null, null); setShowStatusEdit(false); }}
                    className="flex-1 rounded border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSaveStatus} disabled={savingStatus}
                    className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingStatus ? "…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tasks tab */}
        {profileTab === "task" && (
          <div className="flex flex-col">
            {loadingTasks ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              </div>
            ) : assignedTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Calendar className="h-8 w-8 text-slate-200" />
                <p className="text-xs text-slate-400">No tasks assigned to {user.firstName}</p>
              </div>
            ) : (
              taskGroups.map((group) => {
                if (group.tasks.length === 0) return null;
                const isOpen = expandedGroups[group.key] !== false;
                const isOver = group.key === "overdue";
                return (
                  <div key={group.key} className="border-b border-slate-50 last:border-0">
                    <button
                      onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.key]: !isOpen }))}
                      className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isOver ? "text-red-500" : "text-slate-600"}`}>
                          {group.label}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isOver ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"
                        }`}>
                          {group.tasks.length}
                        </span>
                      </div>
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="flex flex-col divide-y divide-slate-50">
                        {group.tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            isOverdue={isOver}
                            workspaceId={workspaceId}
                            onRefetch={refetchTasks}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Activity tab */}
        {profileTab === "activity" && (
          <ActivityFeed
            workspaceId={workspaceId}
            userId={user.id}
            enabled={profileTab === "activity"}
          />
        )}
      </div>
    </div>
  );
}
