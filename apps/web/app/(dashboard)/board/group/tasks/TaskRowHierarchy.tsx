"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableTaskRow } from "./SortableTaskRow";
import { SortableSubtaskRow } from "./sub-tasks/SortableSubTaskRow";
import { SubtaskList } from "./sub-tasks/SubTaskList";

interface Props {
  task: any;
  columns: any[];
  color: string;
}

export function TaskHierarchyRow({
  task,
  columns,
  color,
}: Props) {
  const subtasks = task.subtasks ?? [];

  const hasSubtasks = subtasks.length > 0;

  return (
    <>
      {/* =========================================
          PARENT TASK
      ========================================== */}

      <SortableTaskRow
        task={task}
        columns={columns}
        color={color}
        onToggleSubtasks={() => {}}
        hasSubtasks={hasSubtasks}
        expanded={true}
      />

      {/* =========================================
          REAL SUBTASKS
      ========================================== */}

      {hasSubtasks && (
        <SortableContext
          items={subtasks.map(
            (subtask: any) =>
              `subtask-${subtask.id}`,
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
            />
          ))}
        </SortableContext>
      )}

      {/* =========================================
          ADD SUBTASK
      ========================================== */}

      <SubtaskList
        task={task}
        columns={columns}
        color={color}
      />
    </>
  );
}