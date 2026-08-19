"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createTask } from "@/services/tasks.api";
import { useGroupStore } from "@/store/create-group-store";

import { useTaskSelection } from "../group/tasks/sub-tasks/useTaskSelection";
import { BoardContent } from "./BoardContent";
import { BoardHeader } from "./BoardHeader/BoardHeader";
import { useBoard } from "./hooks/useBoard.hooks";
import { useTaskBulkActions } from "./useTaskBulkActions";

import {
  GroupSortOption,
  sortGroups,
} from "./BoardHeader/Filters/GroupSort";

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

  const addNewGroup = useGroupStore((state) => state.addNewGroup);

  const hasDraftGroup = useGroupStore((state) =>
    state.groups.some((group: any) => group.isNew),
  );

  const [newGroupFocusToken, setNewGroupFocusToken] = useState(0);

  const [groupSort, setGroupSort] =
    useState<GroupSortOption>("default");

  const [sortedGroups, setSortedGroups] = useState<any[]>([]);

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
    board,
  });

  /**
   * Keep sorted groups synchronized with the groups
   * coming from useBoard.
   */
  useEffect(() => {
    setSortedGroups(
      sortGroups(dragGroups ?? [], groupSort),
    );
  }, [dragGroups, groupSort]);

  const selection = useTaskSelection(sortedGroups);

  /**
   * Create task
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
        queryKey: ["board", board.id],
      });
    },

    onError: () => {
      toast.error("Failed to create task");
    },
  });

  const {
    bulkDelete,
    bulkUpdate,
    isDeleting,
    isUpdating,
  } = useTaskBulkActions(board.id, () => {
    selection.setSelectedTaskIds(new Set());
  });

  const handleGroupSortChange = (
    value: GroupSortOption,
  ) => {
    setGroupSort(value);

    setSortedGroups(
      sortGroups(dragGroups ?? [], value),
    );
  };

  /**
   * Create a new task in the first group.
   */
  const handleCreateTask = () => {
    const groupId = sortedGroups?.[0]?.id;

    if (!groupId) {
      toast.error("No group available to create task");
      return;
    }

    createMutation.mutate(groupId);
  };

  const handleCreateGroup = () => {
    if (!hasDraftGroup) {
      addNewGroup();
    }

    setNewGroupFocusToken((token) => token + 1);
  };

  const handleBulkDelete = () => {
    bulkDelete([...selection.selectedTaskIds]);
  };

  const handleBulkUpdate = (
    columnId: number,
    value: any,
  ) => {
    bulkUpdate({
      taskIds: [...selection.selectedTaskIds],
      columnId,
      value,
    });
  };

  return (
    <>
      <BoardHeader
        boardId={board?.id}
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
        board={board}
        search={search}
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

      <BulkActionToolbar
        selectedCount={selection.selectedCount}
        columns={board.columns}
        onDelete={handleBulkDelete}
        onUpdate={handleBulkUpdate}
        onClear={() =>
          selection.setSelectedTaskIds(new Set())
        }
        isDeleting={isDeleting}
        isUpdating={isUpdating}
      />
    </>
  );
}