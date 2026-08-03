// hooks/useBoardDnd.ts

"use client";

import { useEffect, useState } from "react";

import { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";

import {
  reorderSubtask,
  ReorderSubtaskDto,
  reorderTask,
  ReorderTaskDto,
} from "@/services/tasks.api";

import { reorderGroup, ReorderGroupDto } from "@/services/groups.api";

import { reorderColumn } from "@/services/columns.api";

import { handleTaskDragOver } from "./dnd/task-dnd";
import { toast } from "sonner";

/* ============================================================
   DRAG DATA
============================================================ */

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
    setDragGroups((currentGroups) => {
      if (JSON.stringify(currentGroups) === JSON.stringify(groups)) {
        return currentGroups;
      }

      return groups;
    });
  }, [groups]);

  useEffect(() => {
    setDragColumns((currentColumns) => {
      if (JSON.stringify(currentColumns) === JSON.stringify(columns)) {
        return currentColumns;
      }

      return columns;
    });
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

  const reorderSubtaskMutation = useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: number;
      data: ReorderSubtaskDto;
    }) => reorderSubtask(boardId, taskId, data),

    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["board", boardId],
      });
    },

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

  function handleDragStart({ active }: DragStartEvent) {
    const activeData = active.data.current as DragData | undefined;

    if (!activeData) {
      return;
    }

    switch (activeData.type) {
      case "task": {
        const group = groups.find((group) => group.id === activeData.groupId);

        const task = group?.tasks.find(
          (task: any) => task.id === activeData.taskId,
        );

        if (!group || !task) {
          return;
        }
        console.log("task is moving...");

        setActiveItem({
          type: "task",
          task,
          group,
        });

        break;
      }

      case "subtask": {
        const group = groups.find((group) => group.id === activeData.groupId);
        const parentTask = group?.tasks.find(
          (task: any) => task.id === activeData.parentId,
        );
        if (!group || !parentTask) {
          console.log("Parent task not found", {
            groupId: activeData.groupId,
            taskId: activeData.taskId,
          });
          return;
        }
        const subtask = parentTask.subtasks?.find(
          (subtask: any) => subtask.id === activeData.taskId,
        );
        if (!subtask) {
          console.log("Subtask not found", {
            subtaskId: activeData.taskId,
            parentTaskId: parentTask.id,
          });
          return;
        }
        console.log("subtask is moving...", {
          subtaskId: subtask.id,
          parentTaskId: parentTask.id,
          groupId: group.id,
        });
        setActiveItem({ type: "subtask", task: subtask, group });
        break;
      }

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
    const overData = over.data.current as DragData | undefined;
    if (!activeData || !overData) {
      return;
    }
    switch (activeData.type) {
      case "subtask": {
        if (overData.type !== "subtask") {
          return;
        }
        if (
          activeData.groupId !== overData.groupId ||
          activeData.parentId !== overData.parentId
        ) {
          return;
        }
        if (activeData.taskId === overData.taskId) {
          return;
        }
        setDragGroups((currentGroups: any[]) => {
          const groupIndex = currentGroups.findIndex(
            (group: any) => group.id === activeData.groupId,
          );
          if (groupIndex === -1) {
            return currentGroups;
          }
          const group = currentGroups[groupIndex];
          const parentTaskIndex = group.tasks.findIndex(
            (task: any) => task.id === activeData.parentId,
          );
          if (parentTaskIndex === -1) {
            return currentGroups;
          }
          const parentTask = group.tasks[parentTaskIndex];
          const subtasks = [...(parentTask.subtasks ?? [])];
          const oldIndex = subtasks.findIndex(
            (subtask: any) => subtask.id === activeData.taskId,
          );
          const newIndex = subtasks.findIndex(
            (subtask: any) => subtask.id === overData.taskId,
          );
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return currentGroups;
          }
          const reorderedSubtasks = arrayMove(subtasks, oldIndex, newIndex);
          const updatedSubtasks = reorderedSubtasks.map(
            (subtask: any, index: number) => ({
              ...subtask,
              order: (index + 1) * 1000,
            }),
          );
          const updatedParentTask = {
            ...parentTask,
            subtasks: updatedSubtasks,
          };
          const updatedGroup = {
            ...group,
            tasks: group.tasks.map((task: any, index: number) =>
              index === parentTaskIndex ? updatedParentTask : task,
            ),
          };
          return currentGroups.map((currentGroup: any, index: number) =>
            index === groupIndex ? updatedGroup : currentGroup,
          );
        });
        break;
      }
      case "task": {
        if (overData.type !== "task" && overData.type !== "group-drop") {
          break;
        }
        const nextGroups = handleTaskDragOver({
          groups: dragGroups,
          activeTaskId: activeData.taskId,
          overTaskId: overData.type === "task" ? overData.taskId : undefined,
          overGroupId:
            overData.type === "group-drop" ? overData.groupId : undefined,
          overType: overData.type,
        });
        setDragGroups(nextGroups);
        break;
      }
      case "group": {
        let overGroupId: number | string | undefined;
        if (overData.type === "group" || overData.type === "group-drop") {
          overGroupId = overData.groupId;
        } else if (overData.type === "task") {
          overGroupId = overData.groupId;
        }
        if (overGroupId === undefined && over.id) {
          const overId = String(over.id);
          const parsed = overId.startsWith("group-")
            ? Number(overId.replace("group-", ""))
            : Number(overId);
          if (!Number.isNaN(parsed)) {
            overGroupId = parsed;
          }
        }
        if (overGroupId === undefined || activeData.groupId === overGroupId) {
          break;
        }
        setDragGroups((currentGroups: any[]) => {
          const oldIndex = currentGroups.findIndex(
            (group: any) => group.id === activeData.groupId,
          );
          const newIndex = currentGroups.findIndex(
            (group: any) => group.id === overGroupId,
          );
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return currentGroups;
          }
          return arrayMove(currentGroups, oldIndex, newIndex);
        });
        break;
      }
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
        if (
          !overColumn ||
          !activeColumn ||
          overColumn.isPrimary ||
          activeColumn.isPrimary
        ) {
          break;
        }
        setDragColumns((currentColumns: any[]) => {
          const oldIndex = currentColumns.findIndex(
            (column: any) => column.id === activeData.columnId,
          );
          const newIndex = currentColumns.findIndex(
            (column: any) => column.id === overData.columnId,
          );
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return currentColumns;
          }
          return arrayMove(currentColumns, oldIndex, newIndex);
        });
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
    if (!activeData || !overData) {
      handleDragCancel();
      return;
    }
    switch (activeData.type) {
      case "task": {
        const sourceGroup = groups.find(
          (group) => group.id === activeData.groupId,
        );

        const destinationGroupId =
          overData.type === "task" ||
          overData.type === "group" ||
          overData.type === "group-drop"
            ? overData.groupId
            : undefined;

        const destinationGroup = dragGroups.find(
          (group) => group.id === destinationGroupId,
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

        const previousTask = destinationTasks[taskIndex - 1] ?? null;

        const nextTask = destinationTasks[taskIndex + 1] ?? null;

        setGroups(dragGroups);

        reorderTaskMutation.mutate({
          taskId: Number(activeData.taskId),
          destinationGroupId: destinationGroup.id,
          previousTaskId: previousTask?.id ?? null,
          nextTaskId: nextTask?.id ?? null,
        });

        break;
      }
      case "subtask": {
        if (overData.type !== "subtask") {
          handleDragCancel();
          return;
        }
        if (
          activeData.groupId !== overData.groupId ||
          activeData.parentId !== overData.parentId
        ) {
          handleDragCancel();
          return;
        }
        const group = dragGroups.find(
          (group: any) => group.id === activeData.groupId,
        );
        if (!group) {
          handleDragCancel();
          return;
        }
        const parentTask = group.tasks.find(
          (task: any) => task.id === activeData.parentId,
        );
        if (!parentTask) {
          handleDragCancel();
          return;
        }
        const subtasks = [...(parentTask.subtasks ?? [])];
        const currentIndex = subtasks.findIndex(
          (subtask: any) => subtask.id === activeData.taskId,
        );
        if (currentIndex === -1) {
          handleDragCancel();
          return;
        }
        const previousSubtask = subtasks[currentIndex - 1] ?? null;
        const nextSubtask = subtasks[currentIndex + 1] ?? null;
        setGroups(dragGroups);
        reorderSubtaskMutation.mutate({
          taskId: Number(activeData.taskId),
          data: {
            previousTaskId: previousSubtask?.id ?? null,
            nextTaskId: nextSubtask?.id ?? null,
          },
        });
        break;
      }
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
        setGroups(dragGroups);
        const previousGroup = dragGroups[newIndex - 1] ?? null;
        const nextGroup = dragGroups[newIndex + 1] ?? null;
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
        setColumns(dragColumns);
        const previousColumn = dragColumns[newIndex - 1] ?? null;
        const nextColumn = dragColumns[newIndex + 1] ?? null;
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
