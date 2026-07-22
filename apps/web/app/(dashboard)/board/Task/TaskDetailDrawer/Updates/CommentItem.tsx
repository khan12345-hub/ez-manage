"use client";

import {
  MessageCircle,
  MoreHorizontal,
  Reply,
} from "lucide-react";

import { useState } from "react";

import { ReplyComposer } from "./ReplyComposer";

interface CommentItemProps {
  comment: any;
  taskId: number;
}

export function CommentItem({
  comment,
  taskId,
}: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);

  return (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar
          name={comment.user?.firstName}
          avatarUrl={comment.user?.avatarUrl}
        />

        <div className="min-w-0 flex-1">
          {/* Comment Header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {comment.user?.firstName}{" "}
              {comment.user?.lastName}
            </span>

            <span className="text-xs text-muted-foreground">
              {comment.createdAt}
            </span>

            <button
              type="button"
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Comment Content */}
          <div className="prose prose-sm max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html: comment.content,
              }}
            />
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                setShowReply(
                  (current) => !current,
                )
              }
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Reply className="h-3.5 w-3.5" />

              {showReply ? "Cancel" : "Reply"}
            </button>

            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />

              Comment
            </button>
          </div>

          {/* Reply Composer */}
          {showReply && (
            <div className="mt-4">
              <ReplyComposer
                taskId={taskId}
                parentCommentId={comment.id}
                onSuccess={() =>
                  setShowReply(false)
                }
                onCancel={() =>
                  setShowReply(false)
                }
              />
            </div>
          )}

          {/* Replies */}
          {comment.replies?.length > 0 && (
            <div className="mt-4 border-l-2 pl-4">
              {comment.replies.map(
                (reply: any) => (
                  <ReplyItem
                    key={reply.id}
                    reply={reply}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyItem({
  reply,
}: {
  reply: any;
}) {
  return (
    <div className="flex gap-3 py-3">
      <Avatar
        name={reply.user?.firstName}
        avatarUrl={reply.user?.avatarUrl}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {reply.user?.firstName}{" "}
            {reply.user?.lastName}
          </span>

          <span className="text-xs text-muted-foreground">
            {reply.createdAt}
          </span>
        </div>

        <div className="prose prose-sm max-w-none">
          <div
            dangerouslySetInnerHTML={{
              __html: reply.content,
            }}
          />
        </div>

        {/* Reply files can be rendered here later */}
      </div>
    </div>
  );
}

function Avatar({
  name,
  avatarUrl,
}: {
  name?: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "User"}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {name
        ?.charAt(0)
        ?.toUpperCase() ?? "U"}
    </div>
  );
}