"use client";

import { forwardRef, useMemo } from "react";

import {
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";

import { Cell } from "../../Cells/Cell";
import { TaskActions } from "./TaskActions";

import { Button } from "@/components/ui/button";

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

export const TaskRow = forwardRef<
  HTMLTableRowElement,
  Props
>(
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
      selected,
      indeterminate,
      onSelect,
      showSelection,
    },
    ref,
  ) => {
    /*
     * Build the cell lookup once per task.
     *
     * Before:
     *
     * columns.map()
     *   ↓
     * task.cells.find()
     *   ↓
     * repeated array scans
     *
     * Now:
     *
     * columns.map()
     *   ↓
     * cellsByColumnId.get()
     *
     * O(1) lookup.
     */
    const cellsByColumnId = useMemo(() => {
      const map = new Map<number, any>();

      for (const cell of task.cells ?? []) {
        map.set(cell.columnId, cell);
      }

      return map;
    }, [task.cells]);

    return (
      <tr
        ref={ref}
        style={style}
        className="group border-b hover:bg-muted/30"
      >
        <td
          style={{
            backgroundColor: color,
          }}
          className="sticky left-0 z-20 w-1 min-w-1"
        />

        <td className="sticky left-1 z-20 min-w-[150px] bg-white">
          <div className="flex items-center gap-2 px-3">
            {showSelection && (
              <button
                {...dragHandleProps}
                type="button"
                className="cursor-grab rounded p-1 hover:bg-muted active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            <Button
              type="button"
              onClick={onToggleSubtasks}
              variant="outline"
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
            </Button>

            <TaskActions task={task} />

            {showSelection && (
              <Checkbox
                checked={
                  indeterminate
                    ? "indeterminate"
                    : selected
                }
                onCheckedChange={onSelect}
                aria-label={`Select ${task.name}`}
              />
            )}
          </div>
        </td>

        {columns.map((column: any) => (
          <Cell
            key={column.id}
            column={column}
            task={task}
            cell={cellsByColumnId.get(column.id)}
            isDragging={isDragging}
          />
        ))}
      </tr>
    );
  },
);

TaskRow.displayName = "TaskRow";