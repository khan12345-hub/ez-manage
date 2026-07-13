"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    size: 280,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
          📋
        </div>

        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.visibility}
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

  {
    id: "actions",
    header: "",
    size: 60,
    cell: () => (
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    ),
  },
];