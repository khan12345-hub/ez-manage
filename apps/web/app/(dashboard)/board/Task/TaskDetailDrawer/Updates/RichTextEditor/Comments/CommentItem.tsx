"use client";

import { Paperclip, Reply } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
// import { ReplyComposer } from "./ReplyComposer";
// import { ReplyItem } from "./ReplyItem";
import { CommentMenu } from "./CommentMenu";
import { DeleteCommentModal } from "./DeleteCommentModal";
import { ReplyComposer } from "./ReplyComposer";
import { FilePreviewModal } from "@/app/(dashboard)/board/Cells/File/Previews/FilePreviewModal";
import { ReplyItem } from "./ReplyItem";
import { CommentEditor } from "./CommentEditor";
import { format } from "date-fns";

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [content, setContent] = useState(comment.content);
  const formattedDate = comment.createdAt
    ? format(comment.createdAt, "do MMMM, yyyy EEEE 'at' h:mm a")
    : "";
  console.log({ comment });
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
              <div
                dangerouslySetInnerHTML={{
                  __html: comment.content,
                }}
              />
            </div>
          )}

          {comment.files?.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPreviewOpen(true)}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              {comment.files.length}{" "}
              {comment.files.length > 1 ? "files" : "file"}
            </Button>
          )}

          <FilePreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            files={comment.files}
            commentId={comment.id}
          />

          <button
            type="button"
            onClick={() => setShowReply((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
            <div className="relative mt-5 ">
              {" "}
              {/* Vertical thread line */}{" "}
              <div className="space-y-1">
                {" "}
                {comment.replies.map((reply: any, index: number) => (
                  <div key={reply.id} className="relative">
                    <ReplyItem
                      reply={reply}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />{" "}
                  </div>
                ))}{" "}
              </div>{" "}
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

function EditComment({
  content,
  setContent,
  onCancel,
  onSave,
}: {
  content: string;
  setContent: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[90px] w-full rounded-md border bg-background p-3 text-sm"
        autoFocus
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>

        <Button size="sm" onClick={onSave} disabled={!content.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
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
        src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL+avatarUrl}
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
