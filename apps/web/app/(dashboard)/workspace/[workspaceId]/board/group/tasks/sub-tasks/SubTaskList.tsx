"use client";
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

  return (
      <NewTaskRow
        groupId={task.groupId}
        parentId={task.id}
        columns={columns}
        color={color}
      />
    
  );
}