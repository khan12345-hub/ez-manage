"use client";

import { BoardHeader } from "./BoardHeader/BoardHeader";
import { useBoard } from "./hooks/useBoard.hooks";
import { BoardContent } from "./BoardContent";

interface BoardProps {
  board: any;
  search: string;
  setSearch: (value: string) => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
}

export function Board({
  board,
  search,
  setSearch,
  isLoading,
  isFetching,
  isError,
}: BoardProps) {
  const {
    filters,
    dragGroups,
    filteredColumns,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useBoard({
    board,
  });

  return (
    <>
      <BoardHeader
        boardId={board?.id}
        onHideColumns={filters.openHideColumnModal}
        personFilter={filters.personFilter}
        onPersonFilterChange={filters.setPersonFilter}
        search={search}
        setSearch={setSearch}
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
      />
    </>
  );
}