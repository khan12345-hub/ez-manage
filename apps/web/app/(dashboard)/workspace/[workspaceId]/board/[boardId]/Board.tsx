"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
    queryKey: ["board-tasks", board.id, search, personFilter],

    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, {
        cursor: pageParam ?? undefined,
        limit: 500,
        search: (search ?? "").trim() || undefined,
        person: personFilter?.users?.length
          ? personFilter.users.map((u: { id: number }) => u.id).join(",")
          : undefined,
      }),

    initialPageParam: null,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : null,

    staleTime: 30 * 60_000,
    gcTime: 120 * 60_000,
    refetchOnMount: false,

    retry: (failureCount, error: any) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 429) return false;
      return failureCount < 2;
    },
    retryDelay: (failureCount) => Math.min(1000 * 2 ** failureCount, 10_000),
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
   * SORT GROUPS — derived synchronously so the board never
   * renders a blank first frame while waiting for an effect.
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

      // Insert the new task immediately into the last loaded page so it's
      // visible at the bottom of its group without waiting for a full refetch.
      queryClient.setQueryData<InfiniteData<BoardTasksResponse>>(
        ["board-tasks", board.id, search, personFilter],
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
   * SCROLL-TRIGGERED PAGINATION
   * ---------------------------------------------------------
   * An IntersectionObserver watches a sentinel div placed just
   * below the last rendered group. When the sentinel enters the
   * viewport (with a 200px lead), the next page is fetched.
   *
   * The observer is only connected when there is a next page
   * and no fetch is already in flight, so duplicate requests
   * are impossible. On error the observer stays disconnected
   * until the user triggers a retry.
   */
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Auto-fetch all pages — don't rely on scroll position.
  // Blank groups happen when their tasks are in later pages and the sentinel
  // never enters the viewport (because the empty rows have no height).
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isTasksError) return;
    const timer = setTimeout(() => fetchNextPage(), 200);
    return () => clearTimeout(timer);
  }, [hasNextPage, isFetchingNextPage, isTasksError, fetchNextPage, loadedTasks.length]);

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

      {/* Sentinel — IntersectionObserver triggers next-page fetch when this enters viewport */}
      <div ref={sentinelRef} aria-hidden="true" />

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
    </SearchHighlightProvider>
  );
}
