"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TaskRow } from "./TaskRow";

interface Props {
  task: any;
  columns: any[];
  color: string;

  onToggleSubtasks?: () => void;
  onCreateSubtask?: () => void;

  hasSubtasks?: boolean;
  expanded?: boolean;

  selected?: boolean;
  indeterminate?: boolean;
  onSelect?: () => void;
  showSelection?: boolean;

  isDragging?: boolean;
}

export function SortableTaskRow({
  task,
  columns,
  color,

  onToggleSubtasks,
  onCreateSubtask,

  hasSubtasks = false,
  expanded = false,

  selected = false,
  indeterminate = false,
  onSelect,
  showSelection = false,
}: Props) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TaskRow
      ref={setNodeRef}
      task={task}
      columns={columns}
      color={color}
      style={style}
      isDragging={isDragging}
      dragHandleProps={{
        ...attributes,
        ...listeners,
        ref: setActivatorNodeRef,
      }}
      hasSubtasks={hasSubtasks}
      expanded={expanded}
      onToggleSubtasks={onToggleSubtasks}
      onCreateSubtask={onCreateSubtask}
      selected={selected}
      indeterminate={indeterminate}
      onSelect={onSelect}
      showSelection={showSelection}
    />
  );
}