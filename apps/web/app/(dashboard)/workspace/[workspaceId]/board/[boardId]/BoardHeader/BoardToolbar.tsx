"use client";

import { useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  Check,
  Download,
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
import { exportBoard } from "@/services/boards.api";
import { useInviteModalStore } from "@/store/invite-modal";

import {
  GROUP_SORT_OPTIONS,
  GroupSortOption,
} from "./Filters/GroupSort";

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

export function BoardToolbar({
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
  const [exporting, setExporting] = useState(false);
  const { workspaceRole, boardRole } = useInviteModalStore();
  const canExport = workspaceRole === "OWNER" || workspaceRole === "ADMIN";
  const effectiveRole = boardRole || workspaceRole;
  const canCreateItems = effectiveRole !== "VIEWER" && effectiveRole !== "GUEST";

  const handleExport = async () => {
    if (!boardId) return;
    setExporting(true);
    try {
      await exportBoard(boardId, boardName ?? "board");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canCreateItems && (
        <AddNewItem
          boardId={boardId}
          onCreateTask={onCreateTask}
          onCreateGroup={onCreateGroup}
        />
      )}

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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs sm:px-3 sm:text-sm">
            <ArrowUpDown className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Sort</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Sort groups
          </div>
          <DropdownMenuSeparator />
          {GROUP_SORT_OPTIONS.map((option, index) => (
            <div key={option.value}>
              {index === 1 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="flex cursor-pointer items-center justify-between"
                onClick={() => onGroupSortChange(option.value)}
              >
                <span>{option.label}</span>
                {groupSort === option.value && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs sm:px-3 sm:text-sm" onClick={onHideColumns}>
        <EyeOff className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Hide</span>
      </Button>

      {boardId && canExport && (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs sm:px-3 sm:text-sm" onClick={handleExport} disabled={exporting}>
          <Download className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export"}</span>
        </Button>
      )}
    </div>
  );
}