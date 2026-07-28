"use client";

import {
  ChevronDown,
  Search,
  Funnel,
  ArrowUpDown,
  EyeOff,
  Rows3,
  MoreHorizontal,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PersonFilter } from "./Filters/PersonFilterPopover";
import {
  PersonValue,
} from "../../Cells/Person/PersonPicker";

interface Props {
  onHideColumns: () => void;
  personFilter: PersonValue | null;
  onPersonFilterChange: (
    value: PersonValue | null,
  ) => void;
}

export function BoardToolbar({
  onHideColumns,
  personFilter,
  onPersonFilterChange,
}: Props) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <Button>
          New task
          <Plus className="ml-2 h-4 w-4" />
        </Button>

        <Button variant="ghost">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>

        <PersonFilter
          value={personFilter}
          onChange={onPersonFilterChange}
        />

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

        <Button
          variant="ghost"
          size="icon"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}