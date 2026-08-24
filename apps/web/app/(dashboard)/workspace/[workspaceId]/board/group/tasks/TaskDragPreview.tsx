"use client";

import { memo } from "react";

interface Props {
  task: any;
  color: string;
}

export const TaskDragPreview = memo(
  function TaskDragPreview({
    task,
    color,
  }: Props) {
    return (
      <div className="flex min-w-[280px] max-w-[500px] items-center gap-3 rounded-md border bg-background px-4 py-3 shadow-2xl">
        <div
          className="h-8 w-1 shrink-0 rounded-full"
          style={{
            backgroundColor: color,
          }}
        />

        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {task?.name || "Untitled task"}
          </div>

          {task?.subtasks?.length > 0 && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {task.subtasks.length}{" "}
              {task.subtasks.length === 1
                ? "subtask"
                : "subtasks"}
            </div>
          )}
        </div>
      </div>
    );
  },
);

TaskDragPreview.displayName =
  "TaskDragPreview";