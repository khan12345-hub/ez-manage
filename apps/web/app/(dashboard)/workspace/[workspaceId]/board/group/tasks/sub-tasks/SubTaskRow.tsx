"use client";

import { forwardRef } from "react";
import { GripVertical, CornerDownRight } from "lucide-react";
import { Cell } from "../../../Cells/Cell";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  task: any;
  columns: any[];
  color: string;
  style?: React.CSSProperties;
  dragHandleProps?: any;
  isDragging?: boolean;
  selection?: any;
}

export const SubtaskRow = forwardRef<HTMLTableRowElement, Props>(
  (
    { task, columns, color, style, dragHandleProps, isDragging, selection },
    ref,
  ) => {
    const taskSelection = selection
      ? selection.getTaskSelectionState(task)
      : {
          selected: false,
          indeterminate: false,
        };
    return (
      <tr
        ref={ref}
        style={style}
        className={`
          group
          border-b
          bg-muted/10
          transition-colors
          hover:bg-muted/30
          ${isDragging ? "opacity-50" : ""}
        `}
      >
        
        <td
          className="w-1.5 p-0 sticky left-0 z-20"
          style={{
            backgroundColor: color,
          }}
        />

        
        <td className="w-10 px-2 sticky left-2 bg-white z-20">
          <div className="flex items-center justify-between">
            <button
              type="button"
              {...dragHandleProps}
              className="
                relative
                z-10
                ml-3
                mr-2
                cursor-grab
                rounded
                p-1
                text-muted-foreground
                opacity-0
                transition-opacity
                hover:bg-muted
                group-hover:opacity-100
                active:cursor-grabbing
              "
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Checkbox
              checked={
                taskSelection.indeterminate
                  ? "indeterminate"
                  : taskSelection.selected
              }
              onCheckedChange={() => selection.toggleTask(task)}
              aria-label={`Select ${task.name}`}
            />
          </div>
        </td>

        
        {columns.map((column: any) => (
          <Cell
            isSubTask={true}
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

SubtaskRow.displayName = "SubtaskRow";
