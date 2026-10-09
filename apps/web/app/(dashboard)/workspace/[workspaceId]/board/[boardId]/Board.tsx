"use client";

import { useEffect, useMemo, useState } from "react";

import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error-message";

import { createTask } from "@/services/tasks.api";
import { BoardTasksResponse, getBoardTasks } from "@/services/boards.api";

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
  const workspaceId = Number(params.workspaceId);

  const addNewGroup = useGroupStore((state) => state.addNewGroup);

  const hasDraftGroup = useGroupStore((state) =>
    state.groups.some((group: any) => group.isNew),
  );

  const [newGroupFocusToken, setNewGroupFocusToken] = useState(0);

  const [groupSort, setGroupSort] = useState<GroupSortOption>("default");

  const [sortedGroups, setSortedGroups] = useState<any[]>([]);

  /**
   * ---------------------------------------------------------
   * DEBOUNCED SEARCH
   * ---------------------------------------------------------
   *
   * `search` changes immediately while the user types.
   *
   * `debouncedSearch` only changes after the user stops typing
   * for 400ms.
   *
   * This prevents an API request for every keystroke.
   */
  const [debouncedSearch, setDebouncedSearch] = useState(search ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search ?? "");
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  /**
   * ---------------------------------------------------------
   * PAGINATED TASKS
   * ---------------------------------------------------------
   */
  const {
    data: tasksData,
    isLoading: isTasksLoading,
    isFetching: isTasksFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError: isTasksError,
  } = useInfiniteQuery<
    BoardTasksResponse,
    Error,
    InfiniteData<BoardTasksResponse>,
    any[],
    number | null
  >({
    queryKey: ["board-tasks", board.id, debouncedSearch, personFilter],

    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, {
        cursor: pageParam ?? undefined,
        limit: 500,
        search: debouncedSearch.trim() || undefined,
        person: personFilter?.users?.length
          ? personFilter.users.map((u) => u.id).join(",")
          : undefined,
      }),

    initialPageParam: null,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : null,

    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,

    retry: (failureCount, error: any) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 429) return failureCount < 2; // max 2 retries on rate-limit
      return failureCount < 2;
    },
    retryDelay: (failureCount, error: any) => {
      const status = (error as any)?.response?.status ?? (error as any)?.status;
      if (status === 429) return 15_000; // wait 15s before retrying rate-limited requests
      return Math.min(1000 * 2 ** failureCount, 10_000);
    },
  });


  /**
   * ---------------------------------------------------------
   * FLATTEN LOADED PAGES
   * ---------------------------------------------------------
   * Memoized so the array reference is stable between renders —
   * a new reference on every render would cascade through
   * useBoard → useBoardDnd → Group → EditableCell and trigger
   * "Maximum update depth exceeded" in EditableCell.useEffect.
   */
  const loadedTasks = useMemo(
    () =>
      Array.from(
        new Map(
          (tasksData?.pages.flatMap((page: any) => page.tasks) ?? []).map(
            (task: any) => [task.id, task],
          ),
        ).values(),
      ),
    [tasksData],
  );

  const totalTaskCount = tasksData?.pages[0]?.total ?? 0;

  /**
   * ---------------------------------------------------------
   * PUT TASKS BACK INTO GROUPS
   * ---------------------------------------------------------
   * Also memoized — board.groups is stable (React Query cache),
   * and loadedTasks only changes when a new page loads.
   */
  const groupsWithTasks = useMemo(
    () =>
      (board.groups ?? []).map((group: any) => ({
        ...group,
        tasks: loadedTasks.filter((task: any) => task.groupId === group.id),
      })),
    [board.groups, loadedTasks],
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
  useEffect(() => {
    setSortedGroups(sortGroups(dragGroups ?? [], groupSort));
  }, [dragGroups, groupSort]);

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

      // Insert the new task immediately into the last loaded page so it's
      // visible at the bottom of its group without waiting for a full refetch.
      queryClient.setQueryData<InfiniteData<BoardTasksResponse>>(
        ["board-tasks", board.id, debouncedSearch, personFilter],
        (old) => {
          if (!old?.pages.length) return old;
          const lastIdx = old.pages.length - 1;
          return {
            ...old,
            pages: old.pages.map((page, i) =>
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

    setSortedGroups(sortGroups(dragGroups ?? [], value));
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
   * AUTO BACKGROUND FETCH — all pages load automatically
   * ---------------------------------------------------------
   * As soon as page N finishes, this effect fires and kicks off
   * page N+1 without waiting for the user to scroll anywhere.
   * The board is never "locked" waiting for scroll; all tasks
   * arrive in the background while the user reads page 1.
   */
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isTasksError) return;
    // Delay next page fetch to avoid burst requests that trigger server 429s.
    // Each page fires 1500 ms after the previous one finishes, not immediately.
    const timer = setTimeout(() => fetchNextPage(), 1500);
    return () => clearTimeout(timer);
  }, [hasNextPage, isFetchingNextPage, isTasksError, fetchNextPage]);

  /**
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <>
      <div className="sticky top-[41px] z-10 -mx-3 sm:-mx-6 bg-background border-b px-3 sm:px-6 py-2">
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
        isLoading={isLoading}
        isTasksLoading={isTasksLoading}
        isFetching={isFetching || (isTasksFetching && !isFetchingNextPage)}
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
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        allTasksLoaded={!hasNextPage && !isFetchingNextPage && !isTasksLoading}
      />

      <BoardHorizontalScrollbar />

      {isFetchingNextPage && (
        <p className="py-2 text-center text-xs text-muted-foreground animate-pulse">
          Loading tasks…
        </p>
      )}

      {!hasNextPage && totalTaskCount > 200 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          All {totalTaskCount.toLocaleString()} tasks loaded
        </p>
      )}

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
    </>
  );
}
