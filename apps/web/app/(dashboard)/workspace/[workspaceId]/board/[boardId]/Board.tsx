import { useTaskSelection } from "../group/tasks/sub-tasks/useTaskSelection";
import { BoardContent } from "./BoardContent";
import { BoardHeader } from "./BoardHeader/BoardHeader";
import { useBoard } from "./hooks/useBoard.hooks";


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

  return (
    <>
      <BoardHeader
        boardId={board?.id}
        onHideColumns={filters.openHideColumnModal}
        personFilter={personFilter}
        onPersonFilterChange={setPersonFilter}
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
        selection={selection}
      />
      
    </>
  );
}