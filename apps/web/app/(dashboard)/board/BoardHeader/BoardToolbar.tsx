"use client";

import {
  ChevronDown,
  Search,
  UserCircle2,
  Funnel,
  ArrowUpDown,
  EyeOff,
  Rows3,
  MoreHorizontal,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function BoardToolbar() {
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

        <Button variant="ghost">
          <UserCircle2 className="mr-2 h-4 w-4" />
          Person
        </Button>

        <Button variant="ghost">
          <Funnel className="mr-2 h-4 w-4" />
          Filter
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>

        <Button variant="ghost">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          Sort
        </Button>

        <Button variant="ghost">
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