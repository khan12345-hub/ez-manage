"use client";

import { forwardRef } from "react";

import {
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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

  selected?: boolean;
  indeterminate?: boolean;
  onSelect?: () => void;
  showSelection?: boolean;
}

export const TaskRow = forwardRef<HTMLTableRowElement, Props>(
  (
    {
      task,
      columns,
      color,
      style,
      dragHandleProps,
      isDragging = false,

      onToggleSubtasks,
      hasSubtasks = false,
      expanded = false,

      selected = false,
      indeterminate = false,
      onSelect,
      showSelection = false,
    },
    ref,
  ) => {
    return (
      <tr
        ref={ref}
        style={style}
        className="group border-b hover:bg-muted/30"
      >
        {/* Group color */}
        <td
          style={{
            backgroundColor: color,
          }}
          className="sticky left-0 z-20 w-1 min-w-1"
        />

        {/* Task name / controls */}
        <td className="sticky left-1 z-20 min-w-[150px] bg-white">
          <div className="flex items-center gap-2 px-3">
            {/* Drag handle */}
            {dragHandleProps && (
              <button
                type="button"
                {...dragHandleProps}
                className="cursor-grab rounded p-1 hover:bg-muted active:cursor-grabbing"
                aria-label={`Drag ${task?.name ?? "task"}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            {/* Subtask toggle */}
            {hasSubtasks ? (
              <Button
                type="button"
                onClick={onToggleSubtasks}
                variant="outline"
                className="h-7 w-7 shrink-0 rounded p-1 hover:bg-muted"
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
              </Button>
            ) : (
              <div className="h-7 w-7 shrink-0" />
            )}

            {/* Task actions */}
            <TaskActions task={task} />

            {/* Selection */}
            {showSelection && (
              <Checkbox
                checked={
                  indeterminate
                    ? "indeterminate"
                    : selected
                }
                onCheckedChange={onSelect}
                aria-label={`Select ${task?.name ?? "task"}`}
              />
            )}
          </div>
        </td>

        {/* Cells */}
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