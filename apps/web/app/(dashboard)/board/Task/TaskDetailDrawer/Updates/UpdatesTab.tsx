"use client";

import { UpdateComposer } from "./UpdateComposer";
import { CommentThread } from "./CommentThread";

interface UpdatesTabProps {
  task: any;
  boardId: number;
}

export function UpdatesTab({
  task,
  boardId,
}: UpdatesTabProps) {
  return (
    <div className="flex min-h-full flex-col">
      <UpdateComposer
        taskId={task.id}
        boardId={boardId}
      />

      <CommentThread
        taskId={task.id}
        boardId={boardId}
      />
    </div>
  );
}