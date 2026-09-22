"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Trash2, UserPlus, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useInviteModalStore } from "@/store/invite-modal";
import { getBoardMembers, type BoardMember } from "@/services/boards.api";
import { RichTextEditor } from "@/app/(dashboard)/workspace/[workspaceId]/board/Task/TaskDetailDrawer/Updates/RichTextEditor/RichTextEditor";
import {
  getFileComments,
  createFileComment,
  deleteFileComment,
  type FileComment,
} from "@/services/file-comments.api";

interface FileCommentPanelProps {
  fileId: number;
  onCollapse?: () => void;
}

/* ── Avatar ─────────────────────────────────────────────────────────── */
function UserAvatar({
  user,
  size = "md",
}: {
  user: { firstName: string; lastName: string; avatarUrl?: string | null };
  size?: "sm" | "md";
}) {
  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const cls =
    size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  const src = user.avatarUrl
    ? user.avatarUrl.startsWith("http")
      ? user.avatarUrl
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${user.avatarUrl}`
    : null;

  if (src) {
    return (
      <img
        src={src}
        alt={`${user.firstName} ${user.lastName}`}
        className={`${cls} shrink-0 rounded-full object-cover`}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          el.nextElementSibling?.removeAttribute("style");
        }}
      />
    );
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground`}
    >
      {initials}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Assign picker ──────────────────────────────────────────────────── */
function AssignPicker({
  boardId,
  selected,
  onSelect,
}: {
  boardId: number;
  selected: BoardMember | null;
  onSelect: (m: BoardMember | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["board-members", boardId, search],
    queryFn: () => getBoardMembers(boardId, search),
    enabled: open && !!boardId,
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Assign to"
        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {selected ? (
          <>
            <UserAvatar user={selected} size="sm" />
            <span className="max-w-[80px] truncate">
              {selected.firstName} {selected.lastName}
            </span>
            <X
              className="h-3 w-3 shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
                setOpen(false);
              }}
            />
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" />
            <span>Assign to</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-md border bg-popover shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full rounded-sm border px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto pb-1">
            {members.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                No members found
              </li>
            )}
            {members.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                >
                  <UserAvatar user={m} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="truncate text-muted-foreground">{m.email}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Comment item ───────────────────────────────────────────────────── */
function CommentItem({
  comment,
  currentUserId,
  fileId,
}: {
  comment: FileComment;
  currentUserId: number;
  fileId: number;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => deleteFileComment(fileId, comment.id),
    onSuccess: () => {
      queryClient.setQueryData<FileComment[]>(
        ["file-comments", fileId],
        (old = []) => old.filter((c) => c.id !== comment.id)
      );
    },
  });

  return (
    <div className="group flex gap-2.5 px-4 py-3 hover:bg-muted/40 transition-colors">
      <UserAvatar user={comment.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold">
            {comment.user.firstName} {comment.user.lastName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(comment.createdAt)}
          </span>
          {currentUserId === comment.user.id && (
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="ml-auto hidden group-hover:flex items-center text-muted-foreground hover:text-destructive transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div
          className="mt-1 text-sm leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: comment.content }}
        />

        {comment.assignedTo && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Assigned to</span>
            <UserAvatar user={comment.assignedTo} size="sm" />
            <span className="font-medium text-foreground">
              {comment.assignedTo.firstName} {comment.assignedTo.lastName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="relative mb-4 h-20 w-20">
        <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full" fill="none">
          <rect x="4" y="22" width="48" height="34" rx="7" fill="#E8EAFF" />
          <rect x="10" y="30" width="24" height="3.5" rx="1.75" fill="#C7CAFF" />
          <rect x="10" y="37" width="18" height="3.5" rx="1.75" fill="#C7CAFF" />
          <path d="M4 52 L14 62 L14 52" fill="#E8EAFF" />
        </svg>
        <div className="absolute bottom-0 right-0 flex h-12 w-12 flex-col items-start justify-center gap-1 rounded-xl bg-primary px-2 shadow-md">
          <div className="h-1.5 w-7 rounded bg-white/60" />
          <div className="h-1.5 w-5 rounded bg-white/60" />
          <span className="mt-0.5 text-sm leading-none">😊</span>
        </div>
      </div>
      <p className="text-sm font-semibold">No comments yet on this asset</p>
      <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">
        Share progress, mention a teammate, or upload a file to get things moving
      </p>
    </div>
  );
}

/* ── Main panel ─────────────────────────────────────────────────────── */
export function FileCommentPanel({ fileId, onCollapse }: FileCommentPanelProps) {
  const { user } = useAuth();
  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [assignedTo, setAssignedTo] = useState<BoardMember | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["file-comments", fileId],
    queryFn: () => getFileComments(fileId),
    enabled: !!fileId,
  });

  const createMutation = useMutation({
    mutationFn: () => createFileComment(fileId, content, assignedTo?.id),
    onSuccess: (newComment) => {
      queryClient.setQueryData<FileComment[]>(
        ["file-comments", fileId],
        (old = []) => [...old, newComment]
      );
      setContent("");
      setFiles([]);
      setAssignedTo(null);
      setEditorKey((k) => k + 1);
    },
  });

  const isEmpty =
    !content.replace(/<[^>]*>/g, "").trim() && files.length === 0;

  return (
    <div className="flex h-full flex-col bg-background">

      {/* ── Header ── */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h3 className="text-sm font-semibold">Comments</h3>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Collapse"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Composer (TOP — like Updates tab) ── */}
      <div className="shrink-0 border-b px-4 py-3 space-y-2">
        <RichTextEditor
          key={editorKey}
          value={content}
          onChange={setContent}
          onFilesChange={setFiles}
          compact
          placeholder="Write a comment..."
        />

        <div className="flex items-center justify-between gap-2">
          {boardId ? (
            <AssignPicker
              boardId={boardId}
              selected={assignedTo}
              onSelect={setAssignedTo}
            />
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={() => {
              if (!isEmpty && !createMutation.isPending)
                createMutation.mutate();
            }}
            disabled={isEmpty || createMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-40 hover:opacity-90"
          >
            {createMutation.isPending ? "Posting…" : "Update"}
          </button>
        </div>
      </div>

      {/* ── Comment list ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!isLoading && comments.length === 0 && <EmptyState />}
        {!isLoading && comments.length > 0 && (
          <div className="divide-y">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={user?.id ?? -1}
                fileId={fileId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
