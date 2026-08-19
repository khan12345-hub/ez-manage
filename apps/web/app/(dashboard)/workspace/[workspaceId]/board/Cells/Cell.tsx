"use client";

import { MessageCircleMore } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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

export function Cell({
  column,
  task,
  isDragging,
  isSubTask,
}: CellProps) {
  const { boardId } = useInviteModalStore();

  const queryClient = useQueryClient();

  const openTaskDetails = useTaskDetailsStore(
    (state) => state.open,
  );

  const isPrimary = column.isPrimary;

  const cell = isPrimary
    ? null
    : task.cells.find(
        (c: any) => c.columnId === column.id,
      );

  const config =
    CELL_CONFIG[
      column.type as keyof typeof CELL_CONFIG
    ];

  if (!config) {
    return (
      <td className="border px-3 py-0">
        —
      </td>
    );
  }

  const Component = config.component;

  const value = config.getValue(
    task,
    cell,
    column,
  );

  const totalComments =
    task?._count?.comments ?? 0;

  return (
    <td
      className={cn(
        "border relative px-3 py-1",
        isPrimary &&
          "sticky left-36 bg-background z-20 min-w-[300px]",
      )}
    >
      <div className="flex items-center gap-2">
        {isSubTask && isPrimary && (
          <div className="flex items-center sticky left-2">
            <div className="absolute -left-3 -top-2.5 h-3 w-6 rounded-bl-3xl border-b border-l border-gray-300" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <EditableCell
            value={value}
            component={Component}
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
                queryClient,
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
              strokeWidth={1.5}
              className={cn(
                "h-6 w-6",
                totalComments > 0 &&
                  "text-primary",
              )}
            />

            {totalComments > 0 && (
              <Badge
                className="
                  absolute
                  text-[9px]!
                  left-4
                  top-4
                  h-4
                  w-4
                  leading-0.25
                "
              >
                {totalComments}
              </Badge>
            )}
          </button>
        )}
      </div>
    </td>
  );
}