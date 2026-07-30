import {
  CornerDownRight,
  Divide,
  MessageCircleMore,
  MessageSquare,
} from "lucide-react";

import { EditableCell } from "../EditableCells/EditableCell";
import { CELL_CONFIG } from "./cell-config";

import { useInviteModalStore } from "@/store/invite-modal";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CellProps {
  column: any;
  task: any;
  isDragging?: boolean;
  isSubTask?: boolean;
}

export function Cell({ column, task, isDragging, isSubTask }: CellProps) {
  const { boardId } = useInviteModalStore();

  const openTaskDetails = useTaskDetailsStore((state) => state.open);

  const isPrimary = column.isPrimary;

  const cell = isPrimary
    ? null
    : task.cells.find((c: any) => c.columnId === column.id);

  const config = CELL_CONFIG[column.type as keyof typeof CELL_CONFIG];

  if (!config) {
    return <td className="border px-3 py-2">—</td>;
  }

  const Editor = config.editor;

  const value = config.getValue(task, cell, column);

  const totalComments = task?._count?.comments ?? 0;
  return (
    <td
      className={cn(
        "border relative px-3 py-2",
        isPrimary && "sticky left-36 bg-background z-20 min-w-[300px]",
      )}
    >
      <div className="flex items-center gap-2">
        {isSubTask && isPrimary && (
          <div className="flex items-center sticky left-2">
            {/* Vertical connecting line */}
            {/* <div className="absolute -top-6 h-10 w-px bg-gray-300" /> */}

            {/* Horizontal connecting line */}
            <div className="absolute -left-3 -top-2.5 h-3 w-6 rounded-bl-3xl border-b border-l border-gray-300" />
            {/* <CornerDownRight size={16} className="text-gray-400" /> */}
          </div>
        )}

        <div className={`min-w-0 flex-1 ${isPrimary && "border-r"}`}>
          <EditableCell
            value={value}
            render={config.render}
            editor={Editor}
            cell={cell}
            column={column}
            isDragging={isDragging}
            onSave={(value) =>
              config.save({
                task,
                cell,
                column,
                value,
                boardId,
              })
            }
          />
        </div>
        {isPrimary && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();

              openTaskDetails({
                taskId: task.id,
                boardId,
                groupId: task.groupId,
              });
            }}
            className={cn(
              "cursor-pointer flex h-7 w-7 shrink-0",
              "items-center justify-center",
              "rounded-md",
              "text-muted-foreground",
              "hover:bg-muted",
              "hover:text-foreground",
              "transition-colors relative",
            )}
            title="Open task details"
            aria-label="Open task details"
          >
            <MessageCircleMore
              className={`h-8 w-8 ${totalComments > 0 && "text-primary"}`}
            />
            {totalComments > 0 && (
              <Badge className="absolute left-4 top-4 h-4.5 w-4.5 leading-0.5">
                {totalComments}
              </Badge>
            )}
          </button>
        )}
      </div>
    </td>
  );
}
