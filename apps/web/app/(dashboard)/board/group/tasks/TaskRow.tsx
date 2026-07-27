import { forwardRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Cell } from "../../Cells/Cell";
import { TaskActions } from "./TaskActions";

interface Props {
  task: any;
  columns: any[];
  color: string;

  variant?: "task" | "subtask";

  style?: React.CSSProperties;

  dragHandleProps?: any;

  isDragging?: boolean;

  onToggleSubtasks?: () => void;

  hasSubtasks?: boolean;

  expanded?: boolean;
}

export const TaskRow = forwardRef<HTMLTableRowElement, Props>(
  (
    {
      task,
      columns,
      color,
      style,
      dragHandleProps,
      isDragging,
      onToggleSubtasks,
      expanded,
    },
    ref,
  ) => {
    return (
      <tr
        ref={ref}
        style={style}
        className="group border-b hover:bg-muted/30"
      >
        <td
          style={{ backgroundColor: color }}
          className="sticky left-0 w-1"
        />

        <td className="sticky left-0 w-2">
          <div className="flex items-center gap-2 px-3">
            {/* Drag Handle */}
            <button
              {...dragHandleProps}
              className="cursor-grab rounded p-1 hover:bg-muted active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Subtask Toggle */}
            <button
              type="button"
              onClick={onToggleSubtasks}
              className="rounded p-1 hover:bg-muted"
              aria-label={
                expanded
                  ? "Collapse subtasks"
                  : "Expand subtasks"
              }
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <TaskActions task={task} />

            <Checkbox />
          </div>
        </td>

        {columns.map((column: any) => (
          <Cell
            key={column.id}
            column={column}
            task={task}
            isDragging={isDragging}
          />
        ))}
      </tr>
    );
  },
);

TaskRow.displayName = "TaskRow";