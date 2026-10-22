"use client";

import { useCallback, useMemo, useState } from "react";

import {
  InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error-message";

import { createTask } from "@/services/tasks.api";
import { BoardTasksResponse } from "@/services/boards.api";

import { useGroupStore } from "@/store/create-group-store";
import { useTaskSelection } from "../group/tasks/sub-tasks/useTaskSelection";
import { useParams } from "next/navigation";

import { BoardContent } from "./BoardContent";
import { BoardHeader } from "./BoardHeader/BoardHeader";
import { BoardHorizontalScrollbar } from "./BoardHorizontalScrollbar";
import { useBoard } from "./hooks/useBoard.hooks";
import { useTaskBulkActions } from "./useTaskBulkActions";

import { GroupSortOption, sortGroups } from "./BoardHeader/Filters/GroupSort";
import { BulkActionToolbar } from "./BulkActionsToolbar/BulkActionsToolbar";
import { SearchHighlightProvider } from "../context/SearchHighlightContext";

export function Board({
  board,
  search,
  setSearch,
  personFilter,
  setPersonFilter,
  isLoading,
  isFetching,
  isError,
}: any) {
  const queryClient = useQueryClient();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const addNewGroup = useGroupStore((state) => state.addNewGroup);

  const hasDraftGroup = useGroupStore((state) =>
    state.groups.some((group: any) => group.isNew),
  );

  const [newGroupFocusToken, setNewGroupFocusToken] = useState(0);

  const [groupSort, setGroupSort] = useState<GroupSortOption>("default");

  /**
   * ---------------------------------------------------------
   * PER-GROUP TASK MAP (for DnD)
   * ---------------------------------------------------------
   * Each Group fetches its own tasks independently and reports
   * them here so that useBoardDnd has the tasks it needs for
   * drag calculations (finding task positions, source group, etc.).
   */
  const [groupTasksMap, setGroupTasksMap] = useState<Record<number, any[]>>({});

  const handleGroupTasksLoaded = useCallback(
    (groupId: number, tasks: any[]) => {
      setGroupTasksMap((prev) => {
        // Bail out if the reference is already the same array
        if (prev[groupId] === tasks) return prev;
        return { ...prev, [groupId]: tasks };
      });
    },
    [],
  );

  const personFilterKey = personFilter?.users?.length
    ? personFilter.users.map((u: { id: number }) => u.id).join(",")
    : "";

  const searchTrimmed = (search ?? "").trim();

  /**
   * ---------------------------------------------------------
   * PUT TASKS BACK INTO GROUPS (for DnD)
   * ---------------------------------------------------------
   */
  const groupsWithTasks = useMemo(
    () =>
      (board.groups ?? []).map((group: any) => ({
        ...group,
        tasks: groupTasksMap[group.id] ?? [],
      })),
    [board.groups, groupTasksMap],
  );

  /**
   * ---------------------------------------------------------
   * BOARD
   * ---------------------------------------------------------
   */
  const {
    dragGroups,
    filteredColumns,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    filters,
  } = useBoard({
    board: {
      ...board,
      groups: groupsWithTasks,
    },
  });

  /**
   * ---------------------------------------------------------
   * SORT GROUPS
   * ---------------------------------------------------------
   */
  const sortedGroups = useMemo(
    () => sortGroups(dragGroups ?? [], groupSort),
    [dragGroups, groupSort],
  );

  /**
   * ---------------------------------------------------------
   * SELECTION
   * ---------------------------------------------------------
   */
  const selection = useTaskSelection(sortedGroups);

  /**
   * ---------------------------------------------------------
   * CREATE TASK
   * ---------------------------------------------------------
   */
  const createMutation = useMutation({
    mutationFn: (groupId: number) =>
      createTask(
        {
          name: "new task",
          groupId,
          parentId: null,
        },
        board.id,
      ),

    onSuccess: (newTask) => {
      toast.success("Task created");

      // Insert the new task immediately into the correct per-group cache
      // so it appears at the bottom of its group without waiting for a refetch.
      queryClient.setQueryData<InfiniteData<BoardTasksResponse>>(
        ["board-tasks", board.id, newTask.groupId, searchTrimmed, personFilterKey],
        (old) => {
          if (!old?.pages.length) return old;
          const lastIdx = old.pages.length - 1;
          return {
            ...old,
            pages: old.pages.map((page: any, i: number) =>
              i === lastIdx
                ? { ...page, tasks: [...page.tasks, newTask], total: page.total + 1 }
                : page,
            ),
          };
        },
      );
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to create task"));
    },
  });

  /**
   * ---------------------------------------------------------
   * BULK ACTIONS
   * ---------------------------------------------------------
   */
  const { bulkDelete, bulkUpdate, bulkMove, bulkDuplicate, isDeleting, isUpdating, isMoving, isDuplicating } = useTaskBulkActions(
    board.id,
    () => {
      selection.setSelectedTaskIds(new Set());
    },
  );

  /**
   * ---------------------------------------------------------
   * GROUP SORT
   * ---------------------------------------------------------
   */
  const handleGroupSortChange = (value: GroupSortOption) => {
    setGroupSort(value);
  };

  /**
   * ---------------------------------------------------------
   * CREATE TASK
   * ---------------------------------------------------------
   */
  const handleCreateTask = () => {
    const groupId = sortedGroups?.[0]?.id;

    if (!groupId) {
      toast.error("No group available to create task");
      return;
    }

    createMutation.mutate(groupId);
  };

  /**
   * ---------------------------------------------------------
   * CREATE GROUP
   * ---------------------------------------------------------
   */
  const handleCreateGroup = () => {
    if (!hasDraftGroup) {
      addNewGroup();
    }

    setNewGroupFocusToken((token) => token + 1);
  };

  /**
   * ---------------------------------------------------------
   * BULK DELETE
   * ---------------------------------------------------------
   */
  const handleBulkDelete = () => {
    bulkDelete([...selection.selectedTaskIds]);
  };

  /**
   * ---------------------------------------------------------
   * BULK UPDATE
   * ---------------------------------------------------------
   */
  const handleBulkUpdate = (columnId: number, value: any) => {
    bulkUpdate({
      taskIds: [...selection.selectedTaskIds],
      columnId,
      value,
    });
  };

  /**
   * ---------------------------------------------------------
   * BULK MOVE
   * ---------------------------------------------------------
   */
  const handleBulkMove = (targetGroupId: number) => {
    bulkMove({ taskIds: [...selection.selectedTaskIds], targetGroupId });
  };

  /**
   * ---------------------------------------------------------
   * BULK DUPLICATE
   * ---------------------------------------------------------
   */
  const handleBulkDuplicate = (withUpdates: boolean) => {
    bulkDuplicate({ taskIds: [...selection.selectedTaskIds], withUpdates });
  };

  /**
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <SearchHighlightProvider search={search ?? ""}>
      <div className="sticky top-[41px] z-30 -mx-3 sm:-mx-6 bg-background border-b px-3 sm:px-6 py-2">
        <BoardHeader
          boardId={board?.id}
          boardName={board?.name}
          onHideColumns={filters.openHideColumnModal}
          personFilter={personFilter}
          onPersonFilterChange={setPersonFilter}
          search={search}
          setSearch={setSearch}
          onCreateTask={handleCreateTask}
          onCreateGroup={handleCreateGroup}
          groupSort={groupSort}
          onGroupSortChange={handleGroupSortChange}
        />
      </div>

      <BoardContent
        board={{
          ...board,
          groups: sortedGroups,
        }}
        search={search}
        personFilter={personFilter}
        onTasksLoaded={handleGroupTasksLoaded}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        dragGroups={sortedGroups}
        filteredColumns={filteredColumns}
        activeItem={activeItem}
        filters={filters}
        handleDragStart={handleDragStart}
        handleDragOver={handleDragOver}
        handleDragEnd={handleDragEnd}
        handleDragCancel={handleDragCancel}
        selection={selection}
        newGroupFocusToken={newGroupFocusToken}
      />

      <BoardHorizontalScrollbar />

      <BulkActionToolbar
        selectedCount={selection.selectedCount}
        columns={board.columns}
        groups={sortedGroups.map((g: any) => ({ id: g.id, name: g.name }))}
        workspaceId={workspaceId}
        currentBoardId={board.id}
        onDelete={handleBulkDelete}
        onUpdate={handleBulkUpdate}
        onMove={handleBulkMove}
        onDuplicate={handleBulkDuplicate}
        onClear={() => selection.setSelectedTaskIds(new Set())}
        isDeleting={isDeleting}
        isUpdating={isUpdating}
        isMoving={isMoving}
        isDuplicating={isDuplicating}
      />
    </SearchHighlightProvider>
  );
}
