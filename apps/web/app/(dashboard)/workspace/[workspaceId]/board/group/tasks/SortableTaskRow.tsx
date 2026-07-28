"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskRow } from "./TaskRow";

interface Props {
  task: any;
  columns: any[];
  color: string;
  onToggleSubtasks?: () => void;
  hasSubtasks?: boolean;
  expanded?: boolean;
}

export function SortableTaskRow({
  task,
  columns,
  color,
  onToggleSubtasks,
  expanded,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: {
      type: "task",
      taskId: task.id,
      groupId: task.groupId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TaskRow
      ref={setNodeRef}
      style={style}
      dragHandleProps={{
        ...attributes,
        ...listeners,
      }}
      task={task}
      columns={columns}
      color={color}
      isDragging={isDragging}
      onToggleSubtasks={onToggleSubtasks}
      expanded={expanded}
    />
  );
}
