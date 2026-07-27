"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { SubtaskRow } from "./SubTaskRow";

interface Props {
  task: any;
  parentTaskId: number;
  columns: any[];
  color: string;
}

export function SortableSubtaskRow({
  task,
  parentTaskId,
  columns,
  color,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `subtask-${task.id}`,

    data: {
      type: "subtask",

      taskId: task.id,

      groupId: task.groupId,

      parentTaskId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,

    opacity: isDragging ? 0.5 : 1,

    /**
     * Visual indentation.
     * We will improve this inside SubtaskRow later.
     */
  };

  return (
    <SubtaskRow
      ref={setNodeRef}
      task={task}
      columns={columns}
      color={color}
      style={style}
      dragHandleProps={{
        ...attributes,
        ...listeners,
      }}
      isDragging={isDragging}
    />
  );
}