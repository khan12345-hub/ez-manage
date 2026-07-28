"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableSubtaskRow } from "./SortableSubTaskRow";
import { NewTaskRow } from "../AddNewTaskRow";

interface Props {
  task: any;
  columns: any[];
  color: string;
}

export function SubtaskList({
  task,
  columns,
  color,
}: Props) {
  const subtasks = task.subtasks ?? [];

  return (
    <>
      {/* <SortableContext
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
          />
        ))}
      </SortableContext> */}

      <NewTaskRow
        groupId={task.groupId}
        parentId={task.id}
        columns={columns}
        color={color}
      />
    </>
  );
}