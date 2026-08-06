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
  selection?: any;
  showSelection?: boolean;
}

export function TaskHierarchyRow({
  task,
  columns,
  color,
  isDraggingTask,
  selection,
  showSelection
}: Props) {
  const subtasks = task.subtasks ?? [];

  const hasSubtasks = subtasks.length > 0;
  const [isExpanded, setIsExpanded] = useState(false);

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
        onToggleSubtasks={() => setIsExpanded(!isExpanded)}
        hasSubtasks={hasSubtasks}
        expanded={isExpanded}
        showSelection={!!selection}
        selected={taskSelection.selected}
        indeterminate={taskSelection.indeterminate}
        onSelect={
          selection ? () => selection.toggleTask(task) : undefined
        }
        
      />

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
              selection={selection}
            />
          ))}
        </SortableContext>
      )}

      {!isDraggingTask && isExpanded && (
        <SubtaskList task={task} columns={columns} color={color} />
      )}
    </>
  );
}