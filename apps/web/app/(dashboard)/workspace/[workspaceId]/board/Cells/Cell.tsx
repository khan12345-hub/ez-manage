"use client";

import { useRef } from "react";
import { MessageCircleMore, FileInput } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

  // Tracks the latest confirmed updatedAt for this cell.
  // Updated from two sources:
  //   1. The API response in .then() after a successful save (always authoritative).
  //   2. The cell prop — BUT only when the prop carries a STRICTLY NEWER timestamp,
  //      so a stale-cache re-render during a background refetch never overwrites
  //      the fresh T2 that .then() set, sending stale T1 on the next edit → 409.
  const latestCellUpdatedAt = useRef<any>(cell?.updatedAt);
  const propUpdatedAt = cell?.updatedAt;
  if (propUpdatedAt && (!latestCellUpdatedAt.current || propUpdatedAt > latestCellUpdatedAt.current)) {
    latestCellUpdatedAt.current = propUpdatedAt;
  }

  // Serialises saves so two requests never race on the same cell.
  // Root cause of 409: if save #2 fires before save #1's response returns,
  // both carry the same stale updatedAt (T1). Save #2 arrives after DB moved
  // to T2 → WHERE clause mismatches → 409. Fix: queue and flush sequentially.
  const savePending = useRef<{ inFlight: boolean; next: any | null }>({
    inFlight: false,
    next: null,
  });

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
        "group/cell relative border px-3 py-2.5",

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
            editable={column.type !== "CREATION_LOG" && column.type !== "TIME_TRACKING" && column.type !== "FORMULA"}
            onSave={(saveValue) => {
              const flush = (v: any) => {
                const effectiveCell = latestCellUpdatedAt.current !== undefined
                  ? { ...cell, updatedAt: latestCellUpdatedAt.current }
                  : cell;

                savePending.current.inFlight = true;
                const promise = config.save({ task, cell: effectiveCell, column, value: v, boardId, queryClient });

                promise?.then?.((updatedCell: any) => {
                  savePending.current.inFlight = false;

                  if (updatedCell?.updatedAt) {
                    latestCellUpdatedAt.current = updatedCell.updatedAt;
                  }
                  if (updatedCell?.id && updatedCell?.updatedAt) {
                    queryClient.setQueriesData(
                      { queryKey: ["board-tasks", boardId], exact: false },
                      (old: any) => {
                        if (!old?.pages) return old;
                        return {
                          ...old,
                          pages: old.pages.map((page: any) => ({
                            ...page,
                            tasks: (page.tasks ?? []).map((t: any) => ({
                              ...t,
                              cells: (t.cells ?? []).map((c: any) =>
                                c.id === updatedCell.id
                                  ? { ...c, updatedAt: updatedCell.updatedAt }
                                  : c
                              ),
                            })),
                          })),
                        };
                      }
                    );
                  }
                  queryClient.invalidateQueries({ queryKey: ["board-tasks", boardId], exact: false });

                  // Flush the queued value (if another edit arrived while in-flight)
                  if (savePending.current.next !== null) {
                    const next = savePending.current.next;
                    savePending.current.next = null;
                    flush(next);
                  }
                })?.catch?.((err: any) => {
                  savePending.current.inFlight = false;
                  savePending.current.next = null;

                  const status = err?.response?.status ?? err?.status;
                  if (status === 409) {
                    toast.error('This cell was already changed by someone else. Your edit was not saved.');
                    queryClient.invalidateQueries({ queryKey: ["board-tasks", boardId], exact: false });
                  } else if (status === 429) {
                    toast.error('Too many changes at once. Please wait a moment and try again.');
                  } else {
                    toast.error('Failed to save change. Please try again.');
                  }
                });
              };

              if (savePending.current.inFlight) {
                // Another save is in-flight — queue the latest value, discard any older pending
                savePending.current.next = saveValue;
                return;
              }
              flush(saveValue);
            }}
          />
        </div>

        {isPrimary && task?.isFormSubmission && (
          <span
            title="Submitted via form"
            className="flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          >
            <FileInput className="h-3 w-3" />
            Form
          </span>
        )}

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