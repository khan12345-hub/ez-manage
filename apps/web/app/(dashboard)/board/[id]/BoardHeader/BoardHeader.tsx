"use client";

import { BoardToolbar } from "./BoardToolbar";
import {
  PersonValue,
} from "../../Cells/Person/PersonPicker";

interface Props {
  board: any;
  onHideColumns: () => void;
  personFilter: PersonValue | null;
  onPersonFilterChange: (
    value: PersonValue | null,
  ) => void;
}

export function BoardHeader({
  board,
  onHideColumns,
  personFilter,
  onPersonFilterChange,
}: Props) {
  return (
    <BoardToolbar
      onHideColumns={onHideColumns}
      personFilter={personFilter}
      onPersonFilterChange={
        onPersonFilterChange
      }
    />
  );
}