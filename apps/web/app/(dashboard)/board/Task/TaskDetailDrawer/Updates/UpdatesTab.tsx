"use client";

import { UpdateComposer } from "./UpdateComposer";
import { CommentThread } from "./CommentThread";

interface UpdatesTabProps {
  task: any;
}

export function UpdatesTab({
  task,
  
}: UpdatesTabProps) {
  return (
    <div className="flex min-h-full flex-col">
      <UpdateComposer
        taskId={task?.id}
  
      />

      <CommentThread
        taskId={task?.id}
  
      />
    </div>
  );
}