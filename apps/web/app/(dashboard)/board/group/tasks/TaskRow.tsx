import { forwardRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Cell } from "../../Cells/Cell";
import { TaskActions } from "./TaskActions";
import { GripVertical } from "lucide-react";

interface Props {
  task: any;
  columns: any;
  color: string;
  style?: React.CSSProperties;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?:boolean;
}

export const TaskRow = forwardRef<HTMLTableRowElement, Props>(
  ({ task, columns, color, style, dragHandleProps, isDragging  }, ref) => {
    return (
      <tr ref={ref} style={style} className="group border-b hover:bg-muted/30">
        <td style={{ backgroundColor: color }} className="sticky left-0 w-1" />

        <td className="w-2 sticky left-0">
          <div className="flex items-center gap-2 px-3">
            <button
              {...dragHandleProps}
              className="cursor-grab rounded p-1 hover:bg-muted active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <TaskActions task={task} />
            <Checkbox />
          </div>
        </td>

        {columns.map((column: any) => (
          <Cell key={column.id} column={column} task={task} isDragging={isDragging} />
        ))}
      </tr>
    );
  },
);

TaskRow.displayName = "TaskRow";
