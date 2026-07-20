// hooks/dnd/types.ts

export interface Task {
  id: number;
  name: string;
  order: number;
}

export interface Group {
  id: number;
  name: string;
  order: number;
  tasks: Task[];
}

export interface BoardColumn {
  id: number;
  title: string;
  order: number;
}

export type DragData =
  | {
      type: "task";
      taskId: number;
      groupId: number;
    }
  | {
      type: "group";
      groupId: number;
    }
  | {
      type: "group-drop";
      groupId: number;
    }
  | {
      type: "column";
      columnId: number;
    };