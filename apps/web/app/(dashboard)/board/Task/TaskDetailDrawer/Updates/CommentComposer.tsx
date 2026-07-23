"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTaskComment } from "@/services/comments.api";

import { RichTextEditor } from "./RichTextEditor/RichTextEditor";

interface CommentComposerProps {
  boardId: number;
  taskId: number;
}

export function CommentComposer({ boardId, taskId }: CommentComposerProps) {
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const createCommentMutation = useMutation({
    mutationFn: () =>
      createTaskComment(taskId, {
        content,
        files,
      }),

    onSuccess: () => {
      setContent("");
      setFiles([]);

      queryClient.invalidateQueries({
        queryKey: ["task-comments", taskId],
      });
    },
  });

  const handleSubmit = () => {
    const isEmpty = !content.replace(/<[^>]*>/g, "").trim();

    if (isEmpty && files.length === 0) {
      return;
    }

    createCommentMutation.mutate();
  };

  return (
    <div className="space-y-3">
      <RichTextEditor
        value={content}
        onChange={setContent}
        onFilesChange={setFiles}
        placeholder="Write a comment..."
      />

      <div className="flex justify-end">
        <button
          type="button"
          disabled={createCommentMutation.isPending}
          onClick={handleSubmit}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createCommentMutation.isPending ? "Posting..." : "Comment"}
        </button>
      </div>
    </div>
  );
}
