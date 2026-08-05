import { useCallback, useMemo, useState } from "react";

function getAllTaskIds(task: any): number[] {
  return [
    task.id,
    ...(task.subtasks ?? []).flatMap((subtask: any) =>
      getAllTaskIds(subtask),
    ),
  ];
}

function getRootTasks(group: any) {
  return (group.tasks ?? []).filter(
    (task: any) => !task.parentTaskId && !task.parentId,
  );
}

export function useTaskSelection(groups: any[]) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(
    new Set(),
  );

  const visibleTaskIds = useMemo(() => {
    return groups.flatMap((group) =>
      getRootTasks(group).flatMap((task: any) => getAllTaskIds(task)),
    );
  }, [groups]);

  const toggleTask = useCallback((task: any) => {
    const taskIds = getAllTaskIds(task);

    setSelectedTaskIds((current) => {
      const next = new Set(current);

      const shouldDeselect = taskIds.every((id) => next.has(id));

      if (shouldDeselect) {
        taskIds.forEach((id) => next.delete(id));
      } else {
        taskIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }, []);

  const toggleGroup = useCallback((group: any) => {
    const taskIds = getRootTasks(group).flatMap((task: any) =>
      getAllTaskIds(task),
    );

    if (taskIds.length === 0) {
      return;
    }

    setSelectedTaskIds((current) => {
      const next = new Set(current);

      const shouldDeselect = taskIds.every((id:any) => next.has(id));

      if (shouldDeselect) {
        taskIds.forEach((id:any) => next.delete(id));
      } else {
        taskIds.forEach((id:any) => next.add(id));
      }

      return next;
    });
  }, []);

  const toggleSingleTask = useCallback((taskId: number) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);

      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);

      visibleTaskIds.forEach((id) => next.add(id));

      return next;
    });
  }, [visibleTaskIds]);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const getTaskSelectionState = useCallback(
    (task: any) => {
      const taskIds = getAllTaskIds(task);

      const selectedCount = taskIds.filter((id) =>
        selectedTaskIds.has(id),
      ).length;

      return {
        selected:
          taskIds.length > 0 && selectedCount === taskIds.length,
        indeterminate:
          selectedCount > 0 && selectedCount < taskIds.length,
      };
    },
    [selectedTaskIds],
  );

  const getGroupSelectionState = useCallback(
    (group: any) => {
      const taskIds = getRootTasks(group).flatMap((task: any) =>
        getAllTaskIds(task),
      );

      const selectedCount = taskIds.filter((id:any) =>
        selectedTaskIds.has(id),
      ).length;

      return {
        selected:
          taskIds.length > 0 && selectedCount === taskIds.length,
        indeterminate:
          selectedCount > 0 && selectedCount < taskIds.length,
      };
    },
    [selectedTaskIds],
  );

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    selectedCount: selectedTaskIds.size,
    visibleTaskIds,

    toggleTask,
    toggleSingleTask,
    toggleGroup,

    selectAllVisible,
    clearSelection,

    getTaskSelectionState,
    getGroupSelectionState,
  };
}