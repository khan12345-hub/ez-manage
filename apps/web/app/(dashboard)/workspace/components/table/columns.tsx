"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil } from "lucide-react";
import { AssetVisibility } from "@repo/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BoardMembersPopover } from "./BoardMembersPopover";

export interface Board {
  id: number;
  name: string;
  visibility: AssetVisibility;
  owner: string;
  members: number;
  tasks: number;
  updatedAt: string;
}

export function createColumns(
  onNavigate: (board: Board) => void,
  onEdit: (board: Board) => void,
): ColumnDef<Board>[] {
  return [
    {
      accessorKey: "name",
      header: "Board",
      cell: ({ row }) => (
        <button
          className="flex items-center gap-3 text-left w-full"
          onClick={() => onNavigate(row.original)}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm">
            📋
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground hover:underline">
              {row.original.name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {row.original.visibility.toLowerCase()}
            </p>
          </div>
        </button>
      ),
    },
    {
      accessorKey: "owner",
      header: "Owner",
    },
    {
      accessorKey: "members",
      header: "Members",
      cell: ({ row }) => (
        <BoardMembersPopover
          boardId={row.original.id}
          memberCount={row.original.members}
        />
      ),
    },
    {
      accessorKey: "tasks",
      header: "Tasks",
      cell: ({ row }) => (
        <button
          className="hover:underline text-muted-foreground"
          onClick={() => onNavigate(row.original)}
        >
          {row.original.tasks}
        </button>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={() => onEdit(row.original)}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit Board
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

export const columns: ColumnDef<Board>[] = createColumns(() => {}, () => {});
