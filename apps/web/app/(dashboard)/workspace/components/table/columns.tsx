"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AssetVisibility } from "@repo/shared";

export interface Board {
  id: number;
  name: string;
  visibility: AssetVisibility;
  owner: string;
  members: number;
  tasks: number;
  updatedAt: string;
}

export const columns: ColumnDef<Board>[] = [
  {
    accessorKey: "name",
    header: "Board",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm">
          📋
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {row.original.visibility.toLowerCase()}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "owner",
    header: "Owner",
  },
  {
    accessorKey: "members",
    header: "Members",
  },
  {
    accessorKey: "tasks",
    header: "Tasks",
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
  },
];
