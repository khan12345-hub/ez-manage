"use client";

import { useEffect, useRef, useState } from "react";

import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { arrayMove } from "@dnd-kit/sortable";

import {
  reorderSubtask,
  ReorderSubtaskDto,
  reorderTask,
  ReorderTaskDto,
} from "@/services/tasks.api";

import {
  reorderGroup,
  ReorderGroupDto,
} from "@/services/groups.api";

import { reorderColumn } from "@/services/columns.api";

import { toast } from "sonner";

export type DragData =
  | {
      type: "subtask";
      taskId: number;
      groupId: number;
      parentId: number;
    }
  | {
      type: "task";
      taskId: number;
      groupId: number;
    }
  | {
      type: "group";
      groupId: number;
    }
  | {
      type: "group-drop";
      groupId: number;
    }
  | {
      type: "column";
      columnId: number;
    };

interface Props {
  groups: any[];
  setGroups: (groups: any[]) => void;

  columns: any[];
  setColumns: (columns: any[]) => void;

  boardId: number;
}

type ActiveItem =
  | {
      type: "task";
      task: any;
      group: any;
    }
  | {
      type: "subtask";
      task: any;
      group: any;
    }
  | {
      type: "group";
      group: any;
    }
  | {
      type: "column";
      column: any;
    }
  | null;

export function useBoardDnd({
  groups,
  setGroups,
  columns,
  setColumns,
  boardId,
}: Props) {
  const queryClient = useQueryClient();

  const [dragGroups, setDragGroups] =
    useState<any[]>(groups);

  const [dragColumns, setDragColumns] =
    useState<any[]>(columns);

  const [activeItem, setActiveItem] =
    useState<ActiveItem>(null);

  /*
   * Keep the latest server state in refs.
   *
   * This prevents callbacks from depending on
   * rapidly changing render values.
   */
  const groupsRef = useRef(groups);
  const columnsRef = useRef(columns);

  const dragGroupsRef = useRef(dragGroups);
  const dragColumnsRef = useRef(dragColumns);

  const activeItemRef = useRef<ActiveItem>(null);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    dragGroupsRef.current = dragGroups;
  }, [dragGroups]);

  useEffect(() => {
    dragColumnsRef.current = dragColumns;
  }, [dragColumns]);

  useEffect(() => {
    activeItemRef.current = activeItem;
  }, [activeItem]);

  /*
   * Sync server state only when we are NOT dragging.
   *
   * Do not JSON.stringify large boards.
   */
  useEffect(() => {
    if (activeItemRef.current) {
      return;
    }

    setDragGroups(groups);
    dragGroupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    if (activeItemRef.current) {
      return;
    }

    setDragColumns(columns);
    dragColumnsRef.current = columns;
  }, [columns]);

  /*
   * ============================================================
   * TASK MUTATION
   * ============================================================
   */

  const reorderTaskMutation = useMutation({
    mutationFn: (data: ReorderTaskDto) =>
      reorderTask(boardId, data),

    onError: () => {
      toast.error("Failed to reorder task");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
  });

  /*
   * ============================================================
   * GROUP MUTATION
   * ============================================================
   */

  const reorderGroupMutation = useMutation({
    mutationFn: ({
      boardId,
      data,
    }: {
      boardId: number;
      data: ReorderGroupDto;
    }) => reorderGroup(boardId, data),

    onError: () => {
      toast.error("Failed to reorder group");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
  });

  /*
   * ============================================================
   * COLUMN MUTATION
   * ============================================================
   */

  const reorderColumnMutation = useMutation({
    mutationFn: reorderColumn,

    onError: () => {
      toast.error("Failed to reorder column");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
  });

  /*
   * ============================================================
   * SUBTASK MUTATION
   * ============================================================
   */

  const reorderSubtaskMutation = useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: number;
      data: ReorderSubtaskDto;
    }) =>
      reorderSubtask(boardId, taskId, data),

    onError: () => {
      toast.error("Failed to reorder subtask");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
  });

  /*
   * ============================================================
   * DRAG START
   * ============================================================
   */

  function handleDragStart({
    active,
  }: DragStartEvent) {
    const activeData =
      active.data.current as
        | DragData
        | undefined;

    if (!activeData) {
      return;
    }

    const currentGroups = groupsRef.current;
    const currentColumns = columnsRef.current;

    switch (activeData.type) {
      case "task": {
        const group = currentGroups.find(
          (item: any) =>
            Number(item.id) ===
            Number(activeData.groupId),
        );

        const task = group?.tasks?.find(
          (item: any) =>
            Number(item.id) ===
            Number(activeData.taskId),
        );

        if (!group || !task) {
          return;
        }

        const nextActiveItem = {
          type: "task" as const,
          task,
          group,
        };

        activeItemRef.current =
          nextActiveItem;

        setActiveItem(nextActiveItem);

        break;
      }

      case "subtask": {
        const group = currentGroups.find(
          (item: any) =>
            Number(item.id) ===
            Number(activeData.groupId),
        );

        const parentTask = group?.tasks?.find(
          (item: any) =>
            Number(item.id) ===
            Number(activeData.parentId),
        );

        const subtask =
          parentTask?.subtasks?.find(
            (item: any) =>
              Number(item.id) ===
              Number(activeData.taskId),
          );

        if (!group || !parentTask || !subtask) {
          return;
        }

        const nextActiveItem = {
          type: "subtask" as const,
          task: subtask,
          group,
        };

        activeItemRef.current =
          nextActiveItem;

        setActiveItem(nextActiveItem);

        break;
      }

      case "group": {
        const group = currentGroups.find(
          (item: any) =>
            Number(item.id) ===
            Number(activeData.groupId),
        );

        if (!group) {
          return;
        }

        const nextActiveItem = {
          type: "group" as const,
          group,
        };

        activeItemRef.current =
          nextActiveItem;

        setActiveItem(nextActiveItem);

        break;
      }

      case "column": {
        const column =
          currentColumns.find(
            (item: any) =>
              Number(item.id) ===
              Number(activeData.columnId),
          );

        if (!column) {
          return;
        }

        const nextActiveItem = {
          type: "column" as const,
          column,
        };

        activeItemRef.current =
          nextActiveItem;

        setActiveItem(nextActiveItem);

        break;
      }
    }
  }

  /*
   * ============================================================
   * DRAG OVER
   *
   * IMPORTANT:
   * We intentionally do NOT modify dragGroups here for tasks.
   *
   * dnd-kit already handles the visual transform.
   * The actual array is changed once in DragEnd.
   * ============================================================
   */

  function handleDragOver({
    active,
    over,
  }: DragOverEvent) {
    if (!over) {
      return;
    }

    const activeData =
      active.data.current as
        | DragData
        | undefined;

    const overData =
      over.data.current as
        | DragData
        | undefined;

    if (!activeData || !overData) {
      return;
    }

    /*
     * We don't reorder anything during dragOver.
     *
     * This is the main performance fix.
     */
  }

  /*
   * ============================================================
   * DRAG CANCEL
   * ============================================================
   */

  function handleDragCancel() {
    const currentGroups = groupsRef.current;
    const currentColumns = columnsRef.current;

    dragGroupsRef.current = currentGroups;
    dragColumnsRef.current = currentColumns;

    setDragGroups(currentGroups);
    setDragColumns(currentColumns);

    activeItemRef.current = null;
    setActiveItem(null);
  }

  /*
   * ============================================================
   * DRAG END
   * ============================================================
   */

  function handleDragEnd({
    active,
    over,
  }: DragEndEvent) {
    const activeData =
      active.data.current as
        | DragData
        | undefined;

    const overData =
      over?.data.current as
        | DragData
        | undefined;

    if (!activeData || !overData) {
      handleDragCancel();
      return;
    }

    const currentGroups = groupsRef.current;
    const currentColumns = columnsRef.current;

    switch (activeData.type) {
      /*
       * ========================================================
       * TASK
       * ========================================================
       */

      case "task": {
        if (
          overData.type !== "task" &&
          overData.type !== "group-drop"
        ) {
          handleDragCancel();
          return;
        }

        const sourceGroup = currentGroups.find(
          (group: any) =>
            Number(group.id) ===
            Number(activeData.groupId),
        );

        let destinationGroupId: number;

        if (overData.type === "task") {
          destinationGroupId =
            Number(overData.groupId);
        } else {
          destinationGroupId =
            Number(overData.groupId);
        }

        const destinationGroup =
          currentGroups.find(
            (group: any) =>
              Number(group.id) ===
              destinationGroupId,
          );

        if (!sourceGroup || !destinationGroup) {
          handleDragCancel();
          return;
        }

        const sourceTasks =
          sourceGroup.tasks ?? [];

        const destinationTasks = [
          ...(destinationGroup.tasks ?? []),
        ];

        /*
         * Remove the dragged task from destination
         * before calculating the final position.
         */
        const draggedTaskIndex =
          destinationTasks.findIndex(
            (task: any) =>
              Number(task.id) ===
              Number(activeData.taskId),
          );

        if (draggedTaskIndex !== -1) {
          destinationTasks.splice(
            draggedTaskIndex,
            1,
          );
        }

        let destinationIndex =
          destinationTasks.length;

        if (overData.type === "task") {
          const overIndex =
            destinationTasks.findIndex(
              (task: any) =>
                Number(task.id) ===
                Number(overData.taskId),
            );

          if (overIndex !== -1) {
            destinationIndex = overIndex;
          }
        }

        const draggedTask =
          sourceTasks.find(
            (task: any) =>
              Number(task.id) ===
              Number(activeData.taskId),
          );

        if (!draggedTask) {
          handleDragCancel();
          return;
        }

        /*
         * Build optimistic task order.
         */
        const nextTasks = [
          ...destinationTasks,
        ];

        nextTasks.splice(
          destinationIndex,
          0,
          draggedTask,
        );

        /*
         * Calculate previous/next using the final array.
         */
        const finalIndex =
          nextTasks.findIndex(
            (task: any) =>
              Number(task.id) ===
              Number(activeData.taskId),
          );

        const previousTask =
          nextTasks[finalIndex - 1] ?? null;

        const nextTask =
          nextTasks[finalIndex + 1] ?? null;

        /*
         * Update local state once.
         */
        const updatedGroups =
          currentGroups.map(
            (group: any) => {
              if (
                Number(group.id) ===
                Number(sourceGroup.id)
              ) {
                return {
                  ...group,
                  tasks:
                    sourceGroup.id ===
                    destinationGroup.id
                      ? nextTasks
                      : sourceTasks.filter(
                          (task: any) =>
                            Number(task.id) !==
                            Number(
                              activeData.taskId,
                            ),
                        ),
                };
              }

              if (
                Number(group.id) ===
                Number(destinationGroup.id)
              ) {
                return {
                  ...group,
                  tasks: nextTasks,
                };
              }

              return group;
            },
          );

        dragGroupsRef.current =
          updatedGroups;

        setDragGroups(updatedGroups);
        setGroups(updatedGroups);

        /*
         * Persist.
         */
        reorderTaskMutation.mutate({
          taskId: Number(
            activeData.taskId,
          ),
          destinationGroupId:
            Number(destinationGroup.id),
          previousTaskId:
            previousTask?.id ?? null,
          nextTaskId:
            nextTask?.id ?? null,
        });

        break;
      }

      /*
       * ========================================================
       * SUBTASK
       * ========================================================
       */

      case "subtask": {
        if (overData.type !== "subtask") {
          handleDragCancel();
          return;
        }

        if (
          Number(activeData.groupId) !==
            Number(overData.groupId) ||
          Number(activeData.parentId) !==
            Number(overData.parentId)
        ) {
          handleDragCancel();
          return;
        }

        const group = currentGroups.find(
          (item: any) =>
            Number(item.id) ===
            Number(activeData.groupId),
        );

        if (!group) {
          handleDragCancel();
          return;
        }

        const parentTask = (
          group.tasks ?? []
        ).find(
          (task: any) =>
            Number(task.id) ===
            Number(activeData.parentId),
        );

        if (!parentTask) {
          handleDragCancel();
          return;
        }

        const subtasks = [
          ...(parentTask.subtasks ?? []),
        ];

        const oldIndex =
          subtasks.findIndex(
            (subtask: any) =>
              Number(subtask.id) ===
              Number(activeData.taskId),
          );

        const newIndex =
          subtasks.findIndex(
            (subtask: any) =>
              Number(subtask.id) ===
              Number(overData.taskId),
          );

        if (
          oldIndex === -1 ||
          newIndex === -1 ||
          oldIndex === newIndex
        ) {
          handleDragCancel();
          return;
        }

        const reorderedSubtasks =
          arrayMove(
            subtasks,
            oldIndex,
            newIndex,
          );

        const finalIndex =
          reorderedSubtasks.findIndex(
            (subtask: any) =>
              Number(subtask.id) ===
              Number(activeData.taskId),
          );

        const previousSubtask =
          reorderedSubtasks[
            finalIndex - 1
          ] ?? null;

        const nextSubtask =
          reorderedSubtasks[
            finalIndex + 1
          ] ?? null;

        const updatedParentTask = {
          ...parentTask,
          subtasks: reorderedSubtasks.map(
            (
              subtask: any,
              index: number,
            ) => ({
              ...subtask,
              order:
                (index + 1) * 1000,
            }),
          ),
        };

        const updatedGroups =
          currentGroups.map(
            (currentGroup: any) => {
              if (
                Number(currentGroup.id) !==
                Number(group.id)
              ) {
                return currentGroup;
              }

              return {
                ...currentGroup,
                tasks: (
                  currentGroup.tasks ?? []
                ).map(
                  (task: any) =>
                    Number(task.id) ===
                    Number(parentTask.id)
                      ? updatedParentTask
                      : task,
                ),
              };
            },
          );

        dragGroupsRef.current =
          updatedGroups;

        setDragGroups(updatedGroups);
        setGroups(updatedGroups);

        reorderSubtaskMutation.mutate({
          taskId: Number(
            activeData.taskId,
          ),
          data: {
            previousTaskId:
              previousSubtask?.id ?? null,
            nextTaskId:
              nextSubtask?.id ?? null,
          },
        });

        break;
      }

      /*
       * ========================================================
       * GROUP
       * ========================================================
       */

      case "group": {
        if (
          overData.type !== "group" &&
          overData.type !== "group-drop" &&
          overData.type !== "task"
        ) {
          handleDragCancel();
          return;
        }

        const oldIndex =
          currentGroups.findIndex(
            (group: any) =>
              Number(group.id) ===
              Number(activeData.groupId),
          );

        const overGroupId =
          Number(overData.groupId);

        const newIndex =
          currentGroups.findIndex(
            (group: any) =>
              Number(group.id) ===
              overGroupId,
          );

        if (
          oldIndex === -1 ||
          newIndex === -1 ||
          oldIndex === newIndex
        ) {
          handleDragCancel();
          return;
        }

        const reorderedGroups =
          arrayMove(
            currentGroups,
            oldIndex,
            newIndex,
          );

        dragGroupsRef.current =
          reorderedGroups;

        setDragGroups(reorderedGroups);
        setGroups(reorderedGroups);

        const finalIndex =
          reorderedGroups.findIndex(
            (group: any) =>
              Number(group.id) ===
              Number(activeData.groupId),
          );

        const previousGroup =
          reorderedGroups[
            finalIndex - 1
          ] ?? null;

        const nextGroup =
          reorderedGroups[
            finalIndex + 1
          ] ?? null;

        reorderGroupMutation.mutate({
          boardId,
          data: {
            groupId: Number(
              activeData.groupId,
            ),
            previousGroupId:
              previousGroup?.id ?? null,
            nextGroupId:
              nextGroup?.id ?? null,
          },
        });

        break;
      }

      /*
       * ========================================================
       * COLUMN
       * ========================================================
       */

      case "column": {
        if (
          overData.type !== "column"
        ) {
          handleDragCancel();
          return;
        }

        const activeColumn =
          currentColumns.find(
            (column: any) =>
              Number(column.id) ===
              Number(
                activeData.columnId,
              ),
          );

        const overColumn =
          currentColumns.find(
            (column: any) =>
              Number(column.id) ===
              Number(overData.columnId),
          );

        if (
          !activeColumn ||
          !overColumn ||
          activeColumn.isPrimary ||
          overColumn.isPrimary
        ) {
          handleDragCancel();
          return;
        }

        const oldIndex =
          currentColumns.findIndex(
            (column: any) =>
              Number(column.id) ===
              Number(
                activeData.columnId,
              ),
          );

        const newIndex =
          currentColumns.findIndex(
            (column: any) =>
              Number(column.id) ===
              Number(
                overData.columnId,
              ),
          );

        if (
          oldIndex === -1 ||
          newIndex === -1 ||
          oldIndex === newIndex
        ) {
          handleDragCancel();
          return;
        }

        const reorderedColumns =
          arrayMove(
            currentColumns,
            oldIndex,
            newIndex,
          );

        dragColumnsRef.current =
          reorderedColumns;

        setDragColumns(reorderedColumns);
        setColumns(reorderedColumns);

        const finalIndex =
          reorderedColumns.findIndex(
            (column: any) =>
              Number(column.id) ===
              Number(
                activeData.columnId,
              ),
          );

        const previousColumn =
          reorderedColumns[
            finalIndex - 1
          ] ?? null;

        const nextColumn =
          reorderedColumns[
            finalIndex + 1
          ] ?? null;

        reorderColumnMutation.mutate({
          boardId,
          columnId: Number(
            activeData.columnId,
          ),
          previousColumnId:
            previousColumn?.id ?? null,
          nextColumnId:
            nextColumn?.id ?? null,
        });

        break;
      }
    }

    activeItemRef.current = null;
    setActiveItem(null);
  }

  return {
    dragGroups,
    setDragGroups,

    dragColumns,
    setDragColumns,

    activeItem,

    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}