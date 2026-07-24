"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RichTextEditor } from "../RichTextEditor";
import { createCommentReply } from "@/services/comments.api";
import { Button } from "@/components/ui/button";
import { Reply } from "lucide-react";





interface ReplyComposerProps {
  taskId: number;
  parentCommentId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReplyComposer({
  taskId,
  parentCommentId,
  onSuccess,
  onCancel,
}: ReplyComposerProps) {
  const queryClient =
    useQueryClient();

  const [content, setContent] =
    useState("");

  const [files, setFiles] =
    useState<File[]>([]);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const handleSubmit = async () => {
    if (
      !content.trim() ||
      isSubmitting
    ) {
      return;
    }

    try {
      setIsSubmitting(true);

      await createCommentReply(
        taskId,
        parentCommentId,
        content,
        files,
      );

      // Refresh comments and replies
      await queryClient.invalidateQueries({
        queryKey: [
          "task-comments",
          taskId,
        ],
      });

      // Reset local state
      setContent("");
      setFiles([]);

      // Close composer
      onSuccess?.();
    } catch (error) {
      console.error(
        "Failed to create reply:",
        error,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <RichTextEditor
        value={content}
        onChange={setContent}
        onFilesChange={setFiles}
        placeholder="Write a reply..."
        compact
        autoFocus
      />

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Cancel
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting
          }
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {isSubmitting
            ? "Replying..."
            : "Reply"}
            <Reply />
        </Button>
      </div>
    </div>
  );
}