"use client";

import { Reply } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { CommentMenu } from "./CommentMenu";
import { DeleteCommentModal } from "./DeleteCommentModal";
import { ReplyComposer } from "./ReplyComposer";
import { ReplyItem } from "./ReplyItem";
import { CommentEditor } from "./CommentEditor";
import { format } from "date-fns";
import FilePreviewItem from "../../../../../Cells/File/Previews/FilePreviewItem";
import { toggleCommentReaction, CommentReaction } from "@/services/comments.api";
import { useMe } from "@/services/auth/auth.hooks";

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

interface CommentItemProps {
  comment: any;
  taskId: number;
  onEdit?: (id: number, content: string) => void;
  onDelete?: (id: number) => void;
}

export function CommentItem({
  comment,
  taskId,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const formattedDate = comment.createdAt
    ? format(comment.createdAt, "do MMMM, yyyy EEEE 'at' h:mm a")
    : "";

  return (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar
          name={comment.user?.firstName}
          avatarUrl={comment.user?.avatarUrl}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {comment.user?.firstName} {comment.user?.lastName}
            </span>

            <span className="text-xs text-muted-foreground">
              {formattedDate}
            </span>

            <div className="ml-auto">
              <CommentMenu
                onEdit={() => setEditing(true)}
                onDelete={() => setDeleteOpen(true)}
              />
            </div>
          </div>

          {editing ? (
            <CommentEditor
              initialContent={comment.content}
              onCancel={() => setEditing(false)}
              onSave={(content) => {
                onEdit?.(comment.id, content);
                setEditing(false);
              }}
            />
          ) : (
            <div className="prose prose-sm max-w-none app-comment-box">
              <div dangerouslySetInnerHTML={{ __html: comment.content }} />
            </div>
          )}

          {comment.files?.length > 0 && (
            <div className="mt-2 grid grid-cols-6 gap-2">
              {comment.files.map((file: any, index: number) => (
                <FilePreviewItem
                  key={`${file.id}-${file.storageKey}-${index}`}
                  commentId={comment.id}
                  file={file}
                  imageOnlyPreview
                />
              ))}
            </div>
          )}

          {/* Reactions row */}
          <CommentReactions
            commentId={comment.id}
            taskId={taskId}
            reactions={comment.reactions ?? []}
            pickerOpen={pickerOpen}
            setPickerOpen={setPickerOpen}
          />

          <button
            type="button"
            onClick={() => setShowReply((v) => !v)}
            className="mt-1 cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Reply className="h-3.5 w-3.5" />
            {showReply ? "Cancel" : "Reply"}
          </button>

          {showReply && (
            <div className="mt-4">
              <ReplyComposer
                taskId={taskId}
                parentCommentId={comment.id}
                onSuccess={() => setShowReply(false)}
                onCancel={() => setShowReply(false)}
              />
            </div>
          )}

          {comment.replies?.length > 0 && (
            <div className="relative mt-5">
              <div className="space-y-1">
                {comment.replies.map((reply: any) => (
                  <div key={reply.id} className="relative">
                    <ReplyItem
                      reply={reply}
                      taskId={taskId}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteCommentModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          onDelete?.(comment.id);
          setDeleteOpen(false);
        }}
        type="comment"
      />
    </div>
  );
}

function CommentReactions({
  commentId,
  taskId,
  reactions,
  pickerOpen,
  setPickerOpen,
}: {
  commentId: number;
  taskId: number;
  reactions: CommentReaction[];
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const myId = me?.id;

  const mutation = useMutation({
    mutationFn: (emoji: string) =>
      toggleCommentReaction(taskId, commentId, emoji),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["task-comments", taskId],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: patchReactions(old.data, commentId, updated),
          };
        },
      );
    },
  });

  // Group reactions by emoji
  const groups = EMOJI_OPTIONS.map((emoji) => {
    const users = reactions.filter((r) => r.emoji === emoji);
    return { emoji, count: users.length, reacted: users.some((r) => r.userId === myId) };
  }).filter((g) => g.count > 0 || pickerOpen);

  const hasReactions = reactions.length > 0;

  if (!hasReactions && !pickerOpen) {
    return (
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
      >
        <span>😊</span> React
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.length > 0 &&
        Object.entries(
          reactions.reduce<Record<string, { count: number; reacted: boolean }>>(
            (acc, r) => {
              if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reacted: false };
              acc[r.emoji]!.count++;
              if (r.userId === myId) acc[r.emoji]!.reacted = true;
              return acc;
            },
            {},
          ),
        ).map(([emoji, { count, reacted }]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => mutation.mutate(emoji)}
            disabled={mutation.isPending}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
              reacted
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-muted/40 hover:border-primary/40 hover:bg-primary/10"
            }`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        ))}

      {/* Emoji picker */}
      {pickerOpen ? (
        <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 shadow-sm">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                mutation.mutate(emoji);
                setPickerOpen(false);
              }}
              className="rounded p-0.5 text-base leading-none hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          +
        </button>
      )}
    </div>
  );
}

function patchReactions(
  comments: any[],
  commentId: number,
  updated: CommentReaction[],
): any[] {
  return comments.map((c) => {
    if (c.id === commentId) return { ...c, reactions: updated };
    if (c.replies?.length) {
      return {
        ...c,
        replies: c.replies.map((r: any) =>
          r.id === commentId ? { ...r, reactions: updated } : r,
        ),
      };
    }
    return c;
  });
}

export function Avatar({
  name,
  avatarUrl,
}: {
  name?: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL + avatarUrl}
        alt={name ?? "User"}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {name?.charAt(0)?.toUpperCase() ?? "U"}
    </div>
  );
}
