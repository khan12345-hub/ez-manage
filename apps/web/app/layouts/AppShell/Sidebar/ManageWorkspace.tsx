import Link from "next/link";
import { MoreHorizontal, Settings } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ManageWorkspaceDropDown({
  workspaceId,
}: {
  workspaceId: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800">
          <MoreHorizontal className="h-4.5 w-4.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link
            href={`/workspace/${workspaceId}`}
            className="flex cursor-pointer items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            <span>Manage Workspace</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
