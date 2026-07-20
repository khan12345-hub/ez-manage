// hooks/useBoardDnd.ts

"use client";

import { useEffect, useState } from "react";
import { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";

import { reorderTask } from "@/services/tasks.api";
import { reorderGroup } from "@/services/groups.api";
import { reorderColumn } from "@/services/columns.api";
import { findTaskLocation } from "./dnd.utils";
import { handleTaskDragOver } from "./dnd/task-dnd";

export type DragData =
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

export function useBoardDnd({
  groups,
  setGroups,
  columns,
  setColumns,
  boardId,
}: Props) {
  const queryClient = useQueryClient();

  const [dragGroups, setDragGroups] = useState(groups);
  const [dragColumns, setDragColumns] = useState(columns);

  const [activeItem, setActiveItem] = useState<
    | {
        type: "task";
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
    | null
  >(null);

  useEffect(() => {
    setDragGroups(groups);
  }, [groups]);

  useEffect(() => {
    setDragColumns(columns);
  }, [columns]);

  const reorderTaskMutation = useMutation({
    mutationFn: reorderTask,
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

  const reorderGroupMutation = useMutation({
    mutationFn: reorderGroup,
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

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as DragData | undefined;

    if (!data) return;

    switch (data.type) {
      case "task": {
        const result = findTaskLocation(dragGroups, data.taskId);

        if (!result) return;

        setActiveItem({
          type: "task",
          task: result.task,
          group: result.group,
        });

        break;
      }

      case "group": {
        const group = dragGroups.find((g: any) => g.id === data.groupId);

        if (!group) return;

        setActiveItem({
          type: "group",
          group,
        });

        break;
      }

      case "column": {
        const column = dragColumns.find((c: any) => c.id === data.columnId);

        if (!column) return;

        setActiveItem({
          type: "column",
          column,
        });

        break;
      }
    }
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;

    const activeData = active.data.current as DragData | undefined;
    if (!activeData) return;

    const overData = over.data.current as DragData | undefined;

    switch (activeData.type) {
      case "task": {
        if (!overData) return;
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

      case "group": {
        // Resolve the target group id from overData, or parse from over.id (e.g. "group-3" or "3")
        let overGroupId: number | string | undefined;

        if (overData) {
          if (overData.type === "group" || overData.type === "group-drop") {
            overGroupId = overData.groupId;
          } else if (overData.type === "task") {
            overGroupId = overData.groupId;
          }
        }

        // Fallback: parse the group id from over.id (handles "group-3" format from SortableGroupContainer)
        if (!overGroupId && over.id) {
          const overId = String(over.id);
          const parsed = overId.startsWith("group-")
            ? Number(overId.replace("group-", ""))
            : Number(overId);
          if (!isNaN(parsed)) overGroupId = parsed;
        }

        if (!overGroupId || activeData.groupId === overGroupId) break;

        const oldIndex = dragGroups.findIndex(
          (g: any) => g.id === activeData.groupId,
        );
        const newIndex = dragGroups.findIndex((g: any) => g.id === overGroupId);

        if (oldIndex !== -1 && newIndex !== -1) {
          setDragGroups(arrayMove(dragGroups, oldIndex, newIndex));
        }
        break;
      }

      case "column": {
        if (!overData) return;
        if (overData.type !== "column") break;
        if (activeData.columnId === overData.columnId) break;

        const overColumn = dragColumns.find(
          (c: any) => c.id === overData.columnId,
        );
        const activeColumn = dragColumns.find(
          (c: any) => c.id === activeData.columnId,
        );

        if (
          !overColumn ||
          !activeColumn ||
          overColumn.isPrimary ||
          activeColumn.isPrimary
        )
          break;

        const oldIndex = dragColumns.findIndex(
          (c: any) => c.id === activeData.columnId,
        );
        const newIndex = dragColumns.findIndex(
          (c: any) => c.id === overData.columnId,
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          setDragColumns(arrayMove(dragColumns, oldIndex, newIndex));
        }
        break;
      }
    }
  }

  function handleDragCancel() {
    setDragGroups(groups);
    setDragColumns(columns);
    setActiveItem(null);
  }

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
      case "task": {
        const sourceGroup = groups.find((g) => g.id === activeData.groupId);

        const destinationGroup = dragGroups.find(
          (g) => g.id === overData?.groupId,
        );

        if (!sourceGroup || !destinationGroup) {
          break;
        }

        const destinationTasks = destinationGroup.tasks;

        const taskIndex = destinationTasks.findIndex(
          (t) => t.id === activeData.taskId,
        );

        if (taskIndex === -1) {
          break;
        }

        const previousTask = destinationTasks[taskIndex - 1];
        const nextTask = destinationTasks[taskIndex + 1];

        // Optimistic UI update
        setGroups(dragGroups);

        reorderTaskMutation.mutate({
          taskId: Number(activeData.taskId),
          destinationGroupId: destinationGroup.id,
          previousTaskId: previousTask?.id ?? null,
          nextTaskId: nextTask?.id ?? null,
        });

        break;
      }

      // case "group": {
      //   const oldIndex = groups.findIndex(
      //     (g: any) => g.id === activeData.groupId,
      //   );
      //   const newIndex = dragGroups.findIndex(
      //     (g: any) => g.id === activeData.groupId,
      //   );

      //   const index = dragGroups.findIndex((g) => g.id === active.id);

      //   const previous = dragGroups[index - 1];
      //   const next = dragGroups[index + 1];

      //   if (oldIndex !== newIndex && newIndex !== -1) {
      //     setGroups(dragGroups);
      //     const targetGroup = groups[newIndex];
      //     reorderGroupMutation.mutate({
      //       boardId,
      //       draggedGroupId: Number(activeData.groupId),
      //       targetGroupId: Number(targetGroup.id),
      //     });
      //   }
      //   break;
      // }

      case "group": {
        const oldIndex = groups.findIndex((g) => g.id === activeData.groupId);

        const newIndex = dragGroups.findIndex(
          (g) => g.id === activeData.groupId,
        );

        if (oldIndex === newIndex || newIndex === -1) {
          break;
        }

        // Update the UI immediately
        setGroups(dragGroups);

        // Find neighbors in the NEW order
        const previousGroup = dragGroups[newIndex - 1];
        const nextGroup = dragGroups[newIndex + 1];

        reorderGroupMutation.mutate({
          boardId,
          groupId: Number(activeData.groupId),
          previousGroupId: previousGroup?.id ?? null,
          nextGroupId: nextGroup?.id ?? null,
        });

        break;
      }

      case "column": {
        const oldIndex = columns.findIndex((c) => c.id === activeData.columnId);

        const newIndex = dragColumns.findIndex(
          (c) => c.id === activeData.columnId,
        );

        if (oldIndex === newIndex || newIndex === -1) {
          break;
        }

        // Optimistically update the UI
        setColumns(dragColumns);

        // Find neighboring columns in the NEW order
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
    }

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
