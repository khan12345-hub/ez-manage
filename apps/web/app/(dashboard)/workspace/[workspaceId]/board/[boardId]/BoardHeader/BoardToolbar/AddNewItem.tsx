"use client";

import {
  ChevronDown,
  FolderPlus,
  ListTodo,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AddNewItemProps {
  boardId?: number;
  onCreateTask: () => void;
  onCreateGroup: () => void;
}

export function AddNewItem({
  boardId,
  onCreateTask,
  onCreateGroup,
}: AddNewItemProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-tour="new-item-btn" disabled={!boardId}>
          <Plus className="mr-2 h-4 w-4" />
          New item
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-52"
      >
        <DropdownMenuLabel>
          Create
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onCreateTask}>
          <ListTodo className="mr-2 h-4 w-4" />
          New task
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onCreateGroup}>
          <FolderPlus className="mr-2 h-4 w-4" />
          New group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}