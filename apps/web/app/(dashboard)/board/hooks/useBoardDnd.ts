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
    const overData = over.data.current as DragData | undefined;

    if (!activeData || !overData) return;

    switch (activeData.type) {
      case "task": {
        const nextGroups = handleTaskDragOver({
          groups: dragGroups,
          activeTaskId: activeData.taskId,
          overTaskId: overData.type === "task" ? overData.taskId : undefined,
          overGroupId:
            overData.type === "group-drop" || overData.type === "group" ? overData.groupId : undefined,
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

        if (!overGroupId || activeData.groupId === overGroupId) break;

        const oldIndex = dragGroups.findIndex((g: any) => g.id === activeData.groupId);
        const newIndex = dragGroups.findIndex((g: any) => g.id === overGroupId);

        if (oldIndex !== -1 && newIndex !== -1) {
          setDragGroups(arrayMove(dragGroups, oldIndex, newIndex));
        }
        break;
      }

      case "column": {
        if (overData.type !== "column") break;
        if (activeData.columnId === overData.columnId) break;

        const overColumn = dragColumns.find((c: any) => c.id === overData.columnId);
        const activeColumn = dragColumns.find((c: any) => c.id === activeData.columnId);

        if (!overColumn || !activeColumn || overColumn.isPrimary || activeColumn.isPrimary) break;

        const oldIndex = dragColumns.findIndex((c: any) => c.id === activeData.columnId);
        const newIndex = dragColumns.findIndex((c: any) => c.id === overData.columnId);

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

      console.log("active", active);
  console.log("over", over);

  console.log("active data", active.data.current);
  console.log("over data", over.data.current);

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    if (!activeData || !overData) {
      handleDragCancel();
      return;
    }

    switch (activeData.type) {
      case "task": {
        const result = findTaskLocation(dragGroups, activeData.taskId);

        if (!result) break;

        setGroups(dragGroups);

        const overTaskId = overData.type === "task" ? overData.taskId : undefined;
        reorderTaskMutation.mutate({
          draggedTaskId: activeData.taskId,
          targetTaskId: overTaskId,
          destinationGroupId: result.group.id,
        });

        break;
      }

      case "group": {
        const oldIndex = groups.findIndex((g: any) => g.id === activeData.groupId);
        const newIndex = dragGroups.findIndex((g: any) => g.id === activeData.groupId);

        if (oldIndex !== newIndex && newIndex !== -1) {
          setGroups(dragGroups);
          const targetGroup = groups[newIndex];
          reorderGroupMutation.mutate({
            boardId,
            draggedGroupId: Number(activeData.groupId),
            targetGroupId: Number(targetGroup.id),
          });
        }
        break;
      }

      case "column": {
        const oldIndex = columns.findIndex((c: any) => c.id === activeData.columnId);
        const newIndex = dragColumns.findIndex((c: any) => c.id === activeData.columnId);

        if (oldIndex !== newIndex && newIndex !== -1) {
          setColumns(dragColumns);
          const targetColumn = columns[newIndex];
          reorderColumnMutation.mutate({
            boardId,
            draggedColumnId: Number(activeData.columnId),
            targetColumnId: Number(targetColumn.id),
          });
        }
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
