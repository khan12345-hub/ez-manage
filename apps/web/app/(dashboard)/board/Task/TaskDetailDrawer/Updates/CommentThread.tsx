"use client";

import { MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { CommentItem } from "./CommentItem";
import { getTaskComments } from "@/services/comments.api";


interface CommentThreadProps {
  taskId: number;
}

export function CommentThread({
  taskId,
}: CommentThreadProps) {
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => getTaskComments(taskId),
    enabled: !!taskId,
  });

  const comments = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 border border-red-600">
        <p className="text-sm text-muted-foreground">
          Loading comments...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-20 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <MessageSquare className="h-9 w-9 text-muted-foreground" />
        </div>

        <h3 className="text-lg font-semibold">
          Failed to load comments
        </h3>

        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Something went wrong while loading the comments.
          Please try again.
        </p>
      </div>
    );
  }

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
      {comments.map((comment:any) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          taskId={taskId}
        />
      ))}
    </div>
  );
}