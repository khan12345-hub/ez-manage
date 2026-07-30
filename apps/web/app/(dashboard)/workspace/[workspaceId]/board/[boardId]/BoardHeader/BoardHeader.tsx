"use client";


import { PersonValue } from "../../Cells/Person/PersonPicker";
import { BoardToolbar } from "./BoardToolbar";

interface Props {
  boardId?: number;
  onHideColumns: () => void;
  personFilter: PersonValue | null;
  onPersonFilterChange: (value: PersonValue | null) => void;
  search: string;
  setSearch: (value: string) => void;
}

export function BoardHeader({
  boardId,
  onHideColumns,
  personFilter,
  onPersonFilterChange,
  search,
  setSearch,
}: Props) {
  return (
    <BoardToolbar
      boardId={boardId}
      onHideColumns={onHideColumns}
      personFilter={personFilter}
      onPersonFilterChange={onPersonFilterChange}
      search={search}
      setSearch={setSearch}
    />
  );
}