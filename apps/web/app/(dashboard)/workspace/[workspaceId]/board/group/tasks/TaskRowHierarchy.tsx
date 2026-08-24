"use client";

import { useState } from "react";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableTaskRow } from "./SortableTaskRow";
import { SortableSubtaskRow } from "./sub-tasks/SortableSubTaskRow";

interface Props {
  task: any;
  columns: any[];
  color: string;
  isDraggingTask?: boolean;
  selection?: any;
  showSelection?: boolean;

  onCreateSubtask?: (task: any) => void;
}

export function TaskHierarchyRow({
  task,
  columns,
  color,
  isDraggingTask = false,
  selection,
  showSelection = false,
  onCreateSubtask,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const subtasks = task?.subtasks ?? [];
  const hasSubtasks = subtasks.length > 0;

  const taskSelection = selection
    ? selection.getTaskSelectionState(task)
    : {
        selected: false,
        indeterminate: false,
      };

  return (
    <>
      <SortableTaskRow
        task={task}
        columns={columns}
        color={color}
        isDragging={isDraggingTask}
        hasSubtasks={hasSubtasks}
        expanded={isExpanded}
        onToggleSubtasks={() => {
          setIsExpanded((previous) => !previous);
        }}
        onCreateSubtask={
          onCreateSubtask
            ? () => onCreateSubtask(task)
            : undefined
        }
        showSelection={showSelection}
        selected={taskSelection.selected}
        indeterminate={taskSelection.indeterminate}
        onSelect={
          selection
            ? () => selection.toggleTask(task)
            : undefined
        }
      />

      {hasSubtasks && isExpanded && !isDraggingTask && (
        <SortableContext
          items={subtasks.map(
            (subtask: any) => `subtask-${subtask.id}`,
          )}
          strategy={verticalListSortingStrategy}
        >
          {subtasks.map((subtask: any) => (
            <SortableSubtaskRow
              key={subtask.id}
              task={subtask}
              parentTaskId={task.id}
              columns={columns}
              color={color}
              selection={selection}
            />
          ))}
        </SortableContext>
      )}
    </>
  );
}