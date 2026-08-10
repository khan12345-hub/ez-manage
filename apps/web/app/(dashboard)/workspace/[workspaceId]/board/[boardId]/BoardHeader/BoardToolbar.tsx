"use client";

import {
  ChevronDown,
  Funnel,
  ArrowUpDown,
  EyeOff,
  Rows3,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { PersonFilter } from "./Filters/PersonFilterPopover";
import { PersonValue } from "../../Cells/Person/PersonPicker";
import { SearchInput } from "./Search/SearchInput";
import { AddNewItem } from "./BoardToolbar/AddNewItem";


interface Props {
  boardId?: number;
  onHideColumns: () => void;
  personFilter: PersonValue | null;
  onPersonFilterChange: (
    value: PersonValue | null
  ) => void;
  search: string;
  setSearch: (value: string) => void;

  onCreateTask?: () => void;
  onCreateGroup?: () => void;
}

export function BoardToolbar({
  boardId,
  onHideColumns,
  personFilter,
  onPersonFilterChange,
  search,
  setSearch,
  onCreateTask,
  onCreateGroup,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <AddNewItem
          boardId={boardId}
          onCreateTask={onCreateTask}
          onCreateGroup={onCreateGroup}
        />

        <SearchInput
          boardId={boardId}
          value={search}
          onChange={setSearch}
        />

        {boardId && (
          <PersonFilter
            boardId={boardId}
            value={personFilter}
            onChange={onPersonFilterChange}
          />
        )}

        <Button variant="ghost">
          <Funnel className="mr-2 h-4 w-4" />
          Filter
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>

        <Button variant="ghost">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          Sort
        </Button>

        <Button
          variant="ghost"
          onClick={onHideColumns}
        >
          <EyeOff className="mr-2 h-4 w-4" />
          Hide
        </Button>

        <Button variant="ghost">
          <Rows3 className="mr-2 h-4 w-4" />
          Group by
        </Button>

        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}