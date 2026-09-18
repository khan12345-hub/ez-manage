"use client";

import { useEffect, useState } from "react";

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
        limit: 100,
        search: debouncedSearch.trim() || undefined,
        person: personFilter?.users?.length
          ? personFilter.users.map((u) => u.id).join(",")
          : undefined,
      }),

    initialPageParam: null,

    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : null,
  });


  /**
   * ---------------------------------------------------------
   * FLATTEN LOADED PAGES
   * ---------------------------------------------------------
   */
  const loadedTasks = Array.from(
    new Map(
      (tasksData?.pages.flatMap((page: any) => page.tasks) ?? []).map(
        (task: any) => [task.id, task],
      ),
    ).values(),
  );

  const totalTaskCount = tasksData?.pages[0]?.total ?? 0;
  const remainingTasks = Math.max(0, totalTaskCount - loadedTasks.length);

  /**
   * ---------------------------------------------------------
   * PUT TASKS BACK INTO GROUPS
   * ---------------------------------------------------------
   */
  const groupsWithTasks = (board.groups ?? []).map((group: any) => ({
    ...group,

    tasks: loadedTasks.filter((task: any) => task.groupId === group.id),
  }));

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

    onSuccess: () => {
      toast.success("Task created");

      queryClient.invalidateQueries({
        queryKey: ["board-tasks", board.id],
      });
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
   * RENDER
   * ---------------------------------------------------------
   */
  return (
    <>
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

      <BoardContent
        board={{
          ...board,
          groups: sortedGroups,
        }}
        search={search}
        isLoading={isLoading || isTasksLoading}
        isFetching={isFetching || isTasksFetching}
        isError={isError || isTasksError}
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
      />

      <BoardHorizontalScrollbar />

      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2 rounded-md border px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              "Loading..."
            ) : (
              <>
                Load more
                {remainingTasks > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {remainingTasks.toLocaleString()} remaining
                  </span>
                )}
              </>
            )}
          </button>
        </div>
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
