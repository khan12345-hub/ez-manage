"use client";

import { useState } from "react";

import { CommentMenu } from "./CommentMenu";
import { DeleteCommentModal } from "./DeleteCommentModal";
import { CommentEditor } from "./CommentEditor";
import { format } from "date-fns";
import { Avatar } from "./CommentItem";
import { FilePreviewModal } from "../../../../../Cells/File/Previews/FilePreviewModal";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface ReplyItemProps {
  reply: any;
  onEdit?: (id: number, content: string) => void;
  onDelete?: (id: number) => void;
}

export function ReplyItem({ reply, onEdit, onDelete }: ReplyItemProps) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPreviewOpen(true)}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              {reply.files.length}{" "}
              {reply.files.length > 1 ? "files" : "file"}
            </Button>
          )}

        <FilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          files={reply.files}
          commentId={reply.id}
        />
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
