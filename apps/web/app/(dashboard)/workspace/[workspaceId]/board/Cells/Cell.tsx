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

  /*
   * Cell is now passed directly from TaskRow.
   *
   * This avoids:
   *
   * task.cells.find(...)
   *
   * for every rendered cell.
   */
  cell?: any;

  isDragging?: boolean;
  isSubTask?: boolean;
}

export function Cell({
  column,
  task,
  cell,
  isDragging,
  isSubTask,
}: CellProps) {
  const { boardId } = useInviteModalStore();

  const queryClient = useQueryClient();

  const openTaskDetails = useTaskDetailsStore(
    (state) => state.open,
  );

  const isPrimary = column.isPrimary;

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
        "relative border px-3 py-1",

        isPrimary &&
          "sticky left-36 z-20 min-w-[300px] bg-background",
      )}
    >
      <div className="flex items-center gap-2">
        {isSubTask && isPrimary && (
          <div className="sticky left-2 flex items-center">
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
            editable={column.type !== "CREATION_LOG"}
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
              "relative flex h-7 w-7 shrink-0 cursor-pointer",
              "items-center justify-center",
              "rounded-md",
              "text-muted-foreground",
              "transition-colors",
              "hover:bg-muted",
              "hover:text-foreground",
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
                  left-4
                  top-4
                  h-4
                  w-4
                  text-[9px]!
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