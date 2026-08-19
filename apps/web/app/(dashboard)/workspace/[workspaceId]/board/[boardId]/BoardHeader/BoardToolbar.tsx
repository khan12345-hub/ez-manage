"use client";

import {
  ArrowUpDown,
  ChevronDown,
  Check,
  EyeOff,
  Funnel,
  MoreHorizontal,
  Rows3,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { PersonFilter } from "./Filters/PersonFilterPopover";
import { PersonValue } from "../../Cells/Person/PersonPicker";
import { SearchInput } from "./Search/SearchInput";
import { AddNewItem } from "./BoardToolbar/AddNewItem";

import {
  GROUP_SORT_OPTIONS,
  GroupSortOption,
} from "./Filters/GroupSort";

interface Props {
  boardId?: number;

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

export function BoardToolbar({
  boardId,
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

        {/* <Button variant="ghost">
          <Funnel className="mr-2 h-4 w-4" />
          Filter
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button> */}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Sort
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-56"
          >
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Sort groups
            </div>

            <DropdownMenuSeparator />

            {GROUP_SORT_OPTIONS.map((option, index) => (
              <div key={option.value}>
                {index === 1 && (
                  <DropdownMenuSeparator />
                )}

                <DropdownMenuItem
                  className="flex cursor-pointer items-center justify-between"
                  onClick={() =>
                    onGroupSortChange(option.value)
                  }
                >
                  <span>{option.label}</span>

                  {groupSort === option.value && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          onClick={onHideColumns}
        >
          <EyeOff className="mr-2 h-4 w-4" />
          Hide
        </Button>

        {/* <Button variant="ghost">
          <Rows3 className="mr-2 h-4 w-4" />
          Group by
        </Button> */}

        {/* <Button
          variant="ghost"
          size="icon"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button> */}
      </div>
    </div>
  );
}