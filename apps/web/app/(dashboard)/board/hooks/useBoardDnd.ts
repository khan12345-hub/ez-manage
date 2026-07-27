// hooks/useBoardDnd.ts

"use client";

import { useEffect, useState } from "react";

import { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";

import { reorderTask, ReorderTaskDto } from "@/services/tasks.api";

import { reorderGroup, ReorderGroupDto } from "@/services/groups.api";

import { reorderColumn } from "@/services/columns.api";

import { handleTaskDragOver } from "./dnd/task-dnd";

/* ============================================================
   DRAG DATA
============================================================ */

export type DragData =
  | {
      type: "task";
      taskId: number;
      groupId: number;
    }
  | {
      type: "subtask";
      taskId: string | number;
      groupId: number;
      parentTaskId: number;
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
      type: "task-drop";
      taskId: number;
      groupId: number;
    }
  | {
      type: "subtask-drop";
      taskId: string | number;
      groupId: number;
      parentTaskId: number;
    }
  | {
      type: "column";
      columnId: number;
    };

/* ============================================================
   PROPS
============================================================ */

interface Props {
  groups: any[];
  setGroups: (groups: any[]) => void;

  columns: any[];
  setColumns: (columns: any[]) => void;

  boardId: number;
}

/* ============================================================
   ACTIVE ITEM
============================================================ */

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

/* ============================================================
   HOOK
============================================================ */

export function useBoardDnd({
  groups,
  setGroups,
  columns,
  setColumns,
  boardId,
}: Props) {
  const queryClient = useQueryClient();

  /* ============================================================
     DRAG STATE
  ============================================================ */

  const [dragGroups, setDragGroups] = useState<any[]>(groups);

  const [dragColumns, setDragColumns] = useState<any[]>(columns);

  const [activeItem, setActiveItem] = useState<ActiveItem>(null);

  /* ============================================================
     SYNC DRAG STATE WITH SERVER STATE
  ============================================================ */

  useEffect(() => {
    setDragGroups(groups);
  }, [groups]);

  useEffect(() => {
    setDragColumns(columns);
  }, [columns]);

  /* ============================================================
     REORDER TASK MUTATION
  ============================================================ */

  const reorderTaskMutation = useMutation({
    mutationFn: (data: ReorderTaskDto) => reorderTask(boardId, data),

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
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

  /* ============================================================
     REORDER GROUP MUTATION
  ============================================================ */

  const reorderGroupMutation = useMutation({
    mutationFn: ({
      boardId,
      data,
    }: {
      boardId: number;
      data: ReorderGroupDto;
    }) => reorderGroup(boardId, data),

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
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

  /* ============================================================
     REORDER COLUMN MUTATION
  ============================================================ */

  const reorderColumnMutation = useMutation({
    mutationFn: reorderColumn,

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
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

  /* ============================================================
     DRAG START
  ============================================================ */

  function handleDragStart({ active }: DragStartEvent) {
    const activeData = active.data.current as DragData | undefined;

    if (!activeData) {
      return;
    }

    switch (activeData.type) {
      /* ========================================================
         TASK
      ======================================================== */

      case "task": {
        const group = groups.find((group) => group.id === activeData.groupId);

        const task = group?.tasks?.find(
          (task: any) => task.id === activeData.taskId,
        );

        if (!group || !task) {
          return;
        }

        setActiveItem({
          type: "task",
          task,
          group,
        });

        break;
      }

      /* ========================================================
         SUBTASK
      ======================================================== */

      case "subtask": {
        const group = groups.find((group) => group.id === activeData.groupId);

        if (!group) {
          return;
        }

        // Find the parent task
        const parentTask = group.tasks?.find(
          (task: any) => task.id === activeData.parentTaskId,
        );

        if (!parentTask) {
          return;
        }

        // Find the real subtask inside the parent's subtasks
        const subtask = parentTask.subtasks?.find(
          (subtask: any) => subtask.id === activeData.taskId,
        );

        if (!subtask) {
          return;
        }

        setActiveItem({
          type: "subtask",
          task: subtask,
          group,
        });

        break;
      }

      /* ========================================================
         GROUP
      ======================================================== */

      case "group": {
        const group = groups.find((group) => group.id === activeData.groupId);

        if (!group) {
          return;
        }

        setActiveItem({
          type: "group",
          group,
        });

        break;
      }

      /* ========================================================
         COLUMN
      ======================================================== */

      case "column": {
        const column = columns.find(
          (column) => column.id === activeData.columnId,
        );

        if (!column) {
          return;
        }

        setActiveItem({
          type: "column",
          column,
        });

        break;
      }

      default:
        break;
    }
  }

  /* ============================================================
     DRAG OVER
  ============================================================ */

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) {
      return;
    }

    const activeData = active.data.current as DragData | undefined;

    if (!activeData) {
      return;
    }

    const overData = over.data.current as DragData | undefined;

    if (!overData) {
      return;
    }

    switch (activeData.type) {
      /* ========================================================
         TASK
      ======================================================== */

      case "task": {
        const nextGroups = handleTaskDragOver({
          groups: dragGroups,

          activeTaskId: activeData.taskId,

          overTaskId: overData.type === "task" ? overData.taskId : undefined,

          overGroupId:
            overData.type === "group-drop" || overData.type === "group"
              ? overData.groupId
              : undefined,

          overType: overData.type,
        });

        setDragGroups(nextGroups);

        break;
      }

      /* ========================================================
         SUBTASK
      ======================================================== */

      case "subtask": {
        /*
         * Dummy subtasks currently live inside
         * TaskHierarchyRow and are not part of
         * dragGroups.
         *
         * Therefore, their local reorder animation
         * is handled automatically by their own
         * SortableContext.
         *
         * We intentionally do not modify dragGroups here.
         */

        break;
      }

      /* ========================================================
         GROUP
      ======================================================== */

      case "group": {
        let overGroupId: number | string | undefined;

        if (overData) {
          if (overData.type === "group" || overData.type === "group-drop") {
            overGroupId = overData.groupId;
          } else if (overData.type === "task") {
            overGroupId = overData.groupId;
          }
        }

        /*
         * Fallback:
         *
         * Handles IDs such as:
         *
         * group-3
         * 3
         */

        if (!overGroupId && over.id) {
          const overId = String(over.id);

          const parsed = overId.startsWith("group-")
            ? Number(overId.replace("group-", ""))
            : Number(overId);

          if (!isNaN(parsed)) {
            overGroupId = parsed;
          }
        }

        if (!overGroupId || activeData.groupId === overGroupId) {
          break;
        }

        const oldIndex = dragGroups.findIndex(
          (group: any) => group.id === activeData.groupId,
        );

        const newIndex = dragGroups.findIndex(
          (group: any) => group.id === overGroupId,
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          setDragGroups(arrayMove(dragGroups, oldIndex, newIndex));
        }

        break;
      }

      /* ========================================================
         COLUMN
      ======================================================== */

      case "column": {
        if (overData.type !== "column") {
          break;
        }

        if (activeData.columnId === overData.columnId) {
          break;
        }

        const overColumn = dragColumns.find(
          (column: any) => column.id === overData.columnId,
        );

        const activeColumn = dragColumns.find(
          (column: any) => column.id === activeData.columnId,
        );

        /*
         * Primary columns cannot be reordered.
         */

        if (
          !overColumn ||
          !activeColumn ||
          overColumn.isPrimary ||
          activeColumn.isPrimary
        ) {
          break;
        }

        const oldIndex = dragColumns.findIndex(
          (column: any) => column.id === activeData.columnId,
        );

        const newIndex = dragColumns.findIndex(
          (column: any) => column.id === overData.columnId,
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          setDragColumns(arrayMove(dragColumns, oldIndex, newIndex));
        }

        break;
      }

      default:
        break;
    }
  }

  /* ============================================================
     DRAG CANCEL
  ============================================================ */

  function handleDragCancel() {
    /*
     * Restore original server state.
     */

    setDragGroups(groups);

    setDragColumns(columns);

    setActiveItem(null);
  }

  /* ============================================================
     DRAG END
  ============================================================ */

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) {
      handleDragCancel();
      return;
    }

    const activeData = active.data.current as DragData | undefined;

    const overData = over.data.current as DragData | undefined;

    if (!activeData) {
      handleDragCancel();
      return;
    }

    switch (activeData.type) {
      /* ========================================================
         TASK
      ======================================================== */

      case "task": {
        const sourceGroup = groups.find(
          (group) => group.id === activeData.groupId,
        );

        const destinationGroup = dragGroups.find(
          (group) => group.id === overData?.groupId,
        );

        if (!sourceGroup || !destinationGroup) {
          break;
        }

        const destinationTasks = destinationGroup.tasks;

        const taskIndex = destinationTasks.findIndex(
          (task: any) => task.id === activeData.taskId,
        );

        if (taskIndex === -1) {
          break;
        }

        const previousTask = destinationTasks[taskIndex - 1];

        const nextTask = destinationTasks[taskIndex + 1];

        /*
         * Optimistic UI update.
         */

        setGroups(dragGroups);

        reorderTaskMutation.mutate({
          taskId: Number(activeData.taskId),

          destinationGroupId: destinationGroup.id,

          previousTaskId: previousTask?.id ?? null,

          nextTaskId: nextTask?.id ?? null,
        });

        break;
      }

      /* ========================================================
         SUBTASK
      ======================================================== */

      case "subtask": {
        /*
         * Dummy subtasks currently only exist
         * inside the TaskHierarchyRow component.
         *
         * Their sorting animation is handled by
         * dnd-kit's SortableContext.
         *
         * We intentionally don't call the backend yet.
         *
         * Later, when dummy subtasks are replaced
         * by real database subtasks, this case should
         * call the subtask reorder API.
         */

        console.log("Subtask drag ended:", {
          taskId: activeData.taskId,

          parentTaskId: activeData.parentTaskId,

          over: overData,
        });

        break;
      }

      /* ========================================================
         GROUP
      ======================================================== */

      case "group": {
        const oldIndex = groups.findIndex(
          (group) => group.id === activeData.groupId,
        );

        const newIndex = dragGroups.findIndex(
          (group) => group.id === activeData.groupId,
        );

        if (oldIndex === newIndex || newIndex === -1) {
          break;
        }

        /*
         * Optimistic UI update.
         */

        setGroups(dragGroups);

        /*
         * Find neighbors in the NEW order.
         */

        const previousGroup = dragGroups[newIndex - 1];

        const nextGroup = dragGroups[newIndex + 1];

        reorderGroupMutation.mutate({
          boardId,

          data: {
            groupId: Number(activeData.groupId),

            previousGroupId: previousGroup?.id ?? null,

            nextGroupId: nextGroup?.id ?? null,
          },
        });

        break;
      }

      /* ========================================================
         COLUMN
      ======================================================== */

      case "column": {
        const oldIndex = columns.findIndex(
          (column) => column.id === activeData.columnId,
        );

        const newIndex = dragColumns.findIndex(
          (column) => column.id === activeData.columnId,
        );

        if (oldIndex === newIndex || newIndex === -1) {
          break;
        }

        /*
         * Optimistic UI update.
         */

        setColumns(dragColumns);

        /*
         * Find neighboring columns
         * in the NEW order.
         */

        const previousColumn = dragColumns[newIndex - 1];

        const nextColumn = dragColumns[newIndex + 1];

        reorderColumnMutation.mutate({
          boardId,

          columnId: Number(activeData.columnId),

          previousColumnId: previousColumn?.id ?? null,

          nextColumnId: nextColumn?.id ?? null,
        });

        break;
      }

      default:
        break;
    }

    setActiveItem(null);
  }

  /* ============================================================
     RETURN
  ============================================================ */

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
