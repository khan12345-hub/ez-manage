"use client";

import Link from "next/link";
import { Check, ChevronDown, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Workspace } from "@repo/shared";



interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  workspace?: Workspace | null;
  onWorkspaceChange?: (workspace: Workspace) => void;
}

export function WorkspaceSwitcher({
  workspaces,
  workspace,
  onWorkspaceChange,
}: WorkspaceSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-10 w-55 items-center justify-between rounded-xs border bg-background px-3 text-sm hover:bg-accent">
          <span className="truncate">{workspace?.name ?? "Select workspace"}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-55 rounded-xs">
        {workspaces.map((item) => (
          <DropdownMenuItem key={item.id} asChild>
            <Link
              href={`/workspace/${item.id}`}
              onClick={() => onWorkspaceChange?.(item)}
              className="flex w-full items-center justify-between"
            >
              <span>{item.name}</span>

              {workspace?.id === item.id && (
                <Check className="h-4 w-4" />
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}