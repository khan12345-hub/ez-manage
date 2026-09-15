"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { CommentMenu } from "./CommentMenu";
import { DeleteCommentModal } from "./DeleteCommentModal";
import { CommentEditor } from "./CommentEditor";
import { format } from "date-fns";
import { Avatar } from "./CommentItem";
import { CommentFilesGallery } from "./CommentFilesGallery";
import { toggleCommentReaction, CommentReaction } from "@/services/comments.api";
import { useMe } from "@/services/auth/auth.hooks";

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

interface ReplyItemProps {
  reply: any;
  taskId: number;
  onEdit?: (id: number, content: string) => void;
  onDelete?: (id: number) => void;
}

export function ReplyItem({ reply, taskId, onEdit, onDelete }: ReplyItemProps) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const myId = me?.id;

  const reactionMutation = useMutation({
    mutationFn: (emoji: string) =>
      toggleCommentReaction(taskId, reply.id, emoji),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
  });

  const [content, setContent] = useState(reply.content);
  const formattedDate = reply.createdAt
    ? format(reply.createdAt, "do MMMM, yyyy EEEE 'at' h:mm a")
    : "";
  return (
    <div className="flex gap-3 py-3">
      <Avatar name={reply.user?.firstName} avatarUrl={reply.user?.avatarUrl} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {reply.user?.firstName} {reply.user?.lastName}
          </span>

          <span className="text-xs text-muted-foreground">{formattedDate}</span>

          <div className="ml-auto">
            <CommentMenu
              onEdit={() => setEditing(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </div>

        {editing ? (
          <CommentEditor
            initialContent={reply.content}
            onCancel={() => setEditing(false)}
            onSave={(content) => {
              onEdit?.(reply.id, content);
              setEditing(false);
            }}
          />
        ) : (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: reply.content,
            }}
          />
        )}

        {reply.files?.length > 0 && (
          <CommentFilesGallery files={reply.files} />
        )}

        {/* Reply reactions */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {reply.reactions?.length > 0 &&
            Object.entries(
              (reply.reactions as CommentReaction[]).reduce<
                Record<string, { count: number; reacted: boolean }>
              >((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reacted: false };
                acc[r.emoji]!.count++;
                if (r.userId === myId) acc[r.emoji]!.reacted = true;
                return acc;
              }, {}),
            ).map(([emoji, { count, reacted }]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => reactionMutation.mutate(emoji)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  reacted
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 hover:border-primary/40"
                }`}
              >
                <span>{emoji}</span>
                <span className="font-medium">{count}</span>
              </button>
            ))}

          {pickerOpen ? (
            <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 shadow-sm">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    reactionMutation.mutate(emoji);
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
                className="ml-1 text-xs text-muted-foreground"
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

      </div>

      <DeleteCommentModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          onDelete?.(reply.id);
          setDeleteOpen(false);
        }}
        type="reply"
      />
    </div>
  );
}
