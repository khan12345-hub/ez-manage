"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableTaskRow } from "./SortableTaskRow";
import { SortableSubtaskRow } from "./sub-tasks/SortableSubTaskRow";
import { SubtaskList } from "./sub-tasks/SubTaskList";
import { useState } from "react";

interface Props {
  task: any;
  columns: any[];
  color: string;
  isDraggingTask?: boolean;
}

export function TaskHierarchyRow({
  task,
  columns,
  color,
  isDraggingTask,
}: Props) {
  const subtasks = task.subtasks ?? [];

  const hasSubtasks = subtasks.length > 0;
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <>
      {/* =========================================
          PARENT TASK
      ========================================== */}

      <SortableTaskRow
        task={task}
        columns={columns}
        color={color}
        onToggleSubtasks={() => setIsExpanded(!isExpanded)}
        hasSubtasks={hasSubtasks}
        expanded={false}
      />

      {/* =========================================
          REAL SUBTASKS
      ========================================== */}

      {hasSubtasks && isExpanded && !isDraggingTask && (
        <SortableContext
          items={subtasks.map((subtask: any) => `subtask-${subtask.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {subtasks.map((subtask: any) => (
            <SortableSubtaskRow
              key={subtask.id}
              task={subtask}
              parentTaskId={task.id}
              columns={columns}
              color={color}
            />
          ))}
        </SortableContext>
      )}

      {/* =========================================
          ADD SUBTASK
      ========================================== */}

      {!isDraggingTask && isExpanded && (
        <SubtaskList task={task} columns={columns} color={color} />
      )}
    </>
  );
}
