"use client";

import { CommentComposer } from "./RichTextEditor/Comments/CommentComposer";
import { CommentThread } from "./RichTextEditor/Comments/CommentThread";

interface UpdatesTabProps {
  task: any;
}

export function UpdatesTab({
  task,
  
}: UpdatesTabProps) {
  return (
    <div className="flex min-h-full flex-col">
      <CommentComposer
        taskId={task?.id}
  
      />

      <CommentThread
        taskId={task?.id}
  
      />
    </div>
  );
}