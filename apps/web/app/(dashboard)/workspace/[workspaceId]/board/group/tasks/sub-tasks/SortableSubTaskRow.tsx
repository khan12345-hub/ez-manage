"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TaskRow } from "../TaskRow";

interface Props {
  task: any;
  parentTaskId: number;
  groupId: number;
  columns: any[];
  color: string;
  selection?: any;
}

export function SortableSubtaskRow({
  task,
  parentTaskId,
  groupId,
  columns,
  color,
  selection,
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
      taskId: Number(task.id),
      groupId: Number(groupId),
      parentId: Number(parentTaskId),
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const taskSelection = selection
    ? selection.getTaskSelectionState(task)
    : {
        selected: false,
        indeterminate: false,
      };

  return (
    <TaskRow
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
      variant="subtask"
      showSelection={!!selection}
      selected={taskSelection.selected}
      indeterminate={taskSelection.indeterminate}
      onSelect={
        selection
          ? () => selection.toggleTask(task)
          : undefined
      }
    />
  );
}