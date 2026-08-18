"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTaskComment } from "@/services/comments.api";
import { RichTextEditor } from "../RichTextEditor";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommentComposerProps {
  taskId: number;
}

export function CommentComposer({ taskId }: CommentComposerProps) {
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [editorKey, setEditorKey] = useState(0);

  const createCommentMutation = useMutation({
    mutationFn: () =>
      createTaskComment(taskId, {
        content,
        files,
      }),

    onSuccess: () => {
      setContent("");
      setFiles([]);

      // Force RichTextEditor to reset its internal state
      setEditorKey((prev) => prev + 1);

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
    <div className="space-y-3 px-4">
      <RichTextEditor
        key={editorKey}
        value={content}
        onChange={setContent}
        onFilesChange={setFiles}
        placeholder="Write a comment..."
      />

      <div className="flex justify-end">
        <Button
          disabled={createCommentMutation.isPending}
          onClick={handleSubmit}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createCommentMutation.isPending ? "Posting..." : "Post"}
          <Send />
        </Button>
      </div>
    </div>
  );
}