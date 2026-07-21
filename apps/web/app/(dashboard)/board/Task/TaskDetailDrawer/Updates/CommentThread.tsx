"use client";

import { MessageSquare } from "lucide-react";

import { CommentItem } from "./CommentItem";

interface CommentThreadProps {
  taskId: number;
  boardId: number;
}

export function CommentThread({
  taskId,
  boardId,
}: CommentThreadProps) {
  // Replace this with useQuery once the API is implemented.
  const comments: any[] = [];

  if (comments.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-20 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <MessageSquare className="h-9 w-9 text-muted-foreground" />
        </div>

        <h3 className="text-lg font-semibold">
          No updates yet
        </h3>

        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Share progress, mention a teammate,
          or upload a file to get things moving
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          taskId={taskId}
          boardId={boardId}
        />
      ))}
    </div>
  );
}