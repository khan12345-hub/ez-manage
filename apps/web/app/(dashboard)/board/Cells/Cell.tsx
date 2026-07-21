import { MessageSquare } from "lucide-react";

import { EditableCell } from "../EditableCells/EditableCell";
import { CELL_CONFIG } from "./cell-config";

import { useInviteModalStore } from "@/store/invite-modal";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { cn } from "@/lib/utils";

interface CellProps {
  column: any;
  task: any;
  isDragging?: boolean;
}

export function Cell({ column, task, isDragging }: CellProps) {
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

  return (
    <td
      className={cn(
        "border relative px-3 py-2",
        isPrimary && "sticky left-0 bg-background z-10",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <EditableCell
            value={value}
            render={config.render}
            editor={Editor}
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
              "flex h-7 w-7 shrink-0",
              "items-center justify-center",
              "rounded-md",
              "text-muted-foreground",
              "hover:bg-muted",
              "hover:text-foreground",
              "transition-colors",
            )}
            title="Open task details"
            aria-label="Open task details"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        )}
      </div>
    </td>
  );
}
