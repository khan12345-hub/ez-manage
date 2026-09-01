"use client";

import { PersonValue } from "../../Cells/Person/PersonPicker";
import { BoardToolbar } from "./BoardToolbar";
import { GroupSortOption } from "../BoardHeader/Filters/GroupSort";

interface Props {
  boardId?: number;
  boardName?: string;

  onHideColumns: () => void;

  personFilter: PersonValue | null;
  onPersonFilterChange: (
    value: PersonValue | null,
  ) => void;

  search: string;
  setSearch: (value: string) => void;

  onCreateTask: () => void;
  onCreateGroup: () => void;

  groupSort: GroupSortOption;
  onGroupSortChange: (
    value: GroupSortOption,
  ) => void;
}

export function BoardHeader({
  boardId,
  boardName,
  onHideColumns,
  personFilter,
  onPersonFilterChange,
  search,
  setSearch,
  onCreateTask,
  onCreateGroup,
  groupSort,
  onGroupSortChange,
}: Props) {
  return (
    <BoardToolbar
      boardId={boardId}
      boardName={boardName}
      onHideColumns={onHideColumns}
      personFilter={personFilter}
      onPersonFilterChange={onPersonFilterChange}
      search={search}
      setSearch={setSearch}
      onCreateTask={onCreateTask}
      onCreateGroup={onCreateGroup}
      groupSort={groupSort}
      onGroupSortChange={onGroupSortChange}
    />
  );
}