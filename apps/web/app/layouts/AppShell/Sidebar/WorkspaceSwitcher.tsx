"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Workspace } from "@repo/shared";

interface WorkspaceSwitcherProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  workspaces: Workspace[];
  workspace?: Workspace | null;
  onWorkspaceChange?: (workspace: Workspace) => void;
  getWorkspaceBoard?: (workspace: Workspace) => Promise<{ id: number } | null>;
}

export function WorkspaceSwitcher({
  open,
  setOpen,
  workspaces,
  workspace,
  onWorkspaceChange,
  getWorkspaceBoard,
}: WorkspaceSwitcherProps) {
  const router = useRouter();

  const handleWorkspaceChange = async (selectedWorkspace: Workspace) => {
    onWorkspaceChange?.(selectedWorkspace);

    if (getWorkspaceBoard) {
      const firstBoard = await getWorkspaceBoard(selectedWorkspace);

      if (firstBoard) {
        router.push(
          `/workspace/${selectedWorkspace.id}/board/${firstBoard.id}`,
        );

        return;
      }
    }

    router.push(`/workspace/${selectedWorkspace.id}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild >
        <button className="flex h-10 w-55 items-center justify-between rounded-xs border bg-background px-3 text-sm hover:bg-accent">
          <span className="truncate">
            {workspace?.name ?? "Select workspace"}
          </span>

          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-55 rounded-xs">
        {workspaces.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={(event) => {
              event.preventDefault();
              handleWorkspaceChange(item);
            }}
            className="cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <span>{item.name}</span>

              {workspace?.id === item.id && <Check className="h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
