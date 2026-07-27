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
}

export const SubtaskRow = forwardRef<HTMLTableRowElement, Props>(
  ({ task, columns, color, style, dragHandleProps, isDragging }, ref) => {
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
        {/* =====================================
            GROUP COLOR / HIERARCHY INDICATOR
        ====================================== */}
        <td
          className="relative w-1.5 p-0"
          style={{
            backgroundColor: color,
          }}
        />

        {/* =====================================
            CHECKBOX
        ====================================== */}
        <td className="w-10 px-2">
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
            <Checkbox/>
          </div>
        </td>

        {/* =====================================
            TASK NAME
        ====================================== */}
        {/* <td className="min-w-[260px] border-l">
          <div className="relative flex min-h-[48px] items-center">
            
            <div
              className="
                absolute
                bottom-0
                left-7
                top-0
                w-px
                bg-border
              "
            />

            
            <div
              className="
                absolute
                left-7
                top-1/2
                h-px
                w-5
                bg-border
              "
            />

            
            

            
            <CornerDownRight className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />

            
            
          </div>
        </td> */}

        {/* =====================================
            OTHER COLUMNS
        ====================================== */}
        {columns.map((column: any) => (
          <Cell key={column.id} column={column} task={task} isDragging={isDragging} />
        ))}
      </tr>
    );
  },
);

SubtaskRow.displayName = "SubtaskRow";
