import { useState } from "react";

import { useGroupStore } from "@/store/create-group-store";

import { useTaskSelection } from "../group/tasks/sub-tasks/useTaskSelection";
import { BoardContent } from "./BoardContent";
import { BoardHeader } from "./BoardHeader/BoardHeader";
import { BulkActionToolbar } from "./BulkActionsToolbar/BulkActionsToolbar";
import { useBoard } from "./hooks/useBoard.hooks";
import { useTaskBulkActions } from "./useTaskBulkActions";
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
  const addNewGroup = useGroupStore((state) => state.addNewGroup);
  const hasDraftGroup = useGroupStore((state) =>
    state.groups.some((group: any) => group.isNew),
  );
  const [newTaskFocusToken, setNewTaskFocusToken] = useState(0);
  const [newGroupFocusToken, setNewGroupFocusToken] = useState(0);

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

  const selection = useTaskSelection(dragGroups);

  const { bulkDelete, bulkUpdate, isDeleting, isUpdating } = useTaskBulkActions(
    board.id,
    () => {
      selection.setSelectedTaskIds(new Set());
    },
  );

  const handleBulkDelete = () => {
    bulkDelete([...selection.selectedTaskIds]);
  };

  const handleBulkUpdate = (columnId: number, value: any) => {
    bulkUpdate({
      taskIds: [...selection.selectedTaskIds],
      columnId,
      value,
    });
  };

  const handleCreateTask = () => {
    setNewTaskFocusToken((token) => token + 1);
  };

  const handleCreateGroup = () => {
    if (!hasDraftGroup) {
      addNewGroup();
    }

    setNewGroupFocusToken((token) => token + 1);
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
      />

      <BoardContent
        board={board}
        search={search}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        dragGroups={dragGroups}
        filteredColumns={filteredColumns}
        activeItem={activeItem}
        filters={filters}
        handleDragStart={handleDragStart}
        handleDragOver={handleDragOver}
        handleDragEnd={handleDragEnd}
        handleDragCancel={handleDragCancel}
        selection={selection}
        newTaskFocusToken={newTaskFocusToken}
        newGroupFocusToken={newGroupFocusToken}
      />

      <BulkActionToolbar
        selectedCount={selection.selectedCount}
        columns={board.columns}
        onDelete={handleBulkDelete}
        onUpdate={handleBulkUpdate}
        onClear={() => selection.setSelectedTaskIds(new Set())}
        isDeleting={isDeleting}
        isUpdating={isUpdating}
      />
    </>
  );
}
