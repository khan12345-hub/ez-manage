"use client";

import { useEffect, useState } from "react";
import {
Search,
Plus,
ChevronLeft,
ChevronRight,
ChevronDown,
Kanban,
Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { getAllWorkspaces } from "@/services/workspace.api";
import type { Workspace } from "@repo/shared";
import { getBoards } from "@/services/boards.api";

import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { CreateBoardModal } from "@/components/CreateBoardModal";
import { ManageWorkspaceDropDown } from "./ManageWorkspace";
import { ManageBoardDropdown } from "./ManageBoard";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

import { useInviteModalStore } from "@/store/invite-modal";

import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SecondarySidebarProps {
isOpen: boolean;
onToggle: () => void;
}

export function SecondarySidebar({
isOpen,
onToggle,
}: SecondarySidebarProps) {
const router = useRouter();
const params = useParams();

const workspaceIdParam = params.workspaceId;
const boardIdParam = params.boardId;

const workspaceId = Number(
Array.isArray(workspaceIdParam)
? workspaceIdParam[0]
: workspaceIdParam,
);

const boardId = Number(
Array.isArray(boardIdParam)
? boardIdParam[0]
: boardIdParam,
);

const [workspace, setWorkspace] =
useState<Workspace | null>(null);

const [isContentExpanded, setIsContentExpanded] =
useState(true);

const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] =
useState(false);

const [isCreateBoardOpen, setIsCreateBoardOpen] =
useState(false);

const {
setBoard,
setBoardRole,
setWorkspace: setWorkspaceID,
setWorkspaceRole,
} = useInviteModalStore();

const {
data: workspaces = [],
} = useQuery({
queryKey: ["workspaces"],
queryFn: getAllWorkspaces,
retry: false,
});

const {
data: boards = [],
isLoading: isBoardsLoading,
} = useQuery({
queryKey: ["boards", workspaceId],
queryFn: () => getBoards(workspaceId),
enabled:
Number.isInteger(workspaceId) &&
workspaceId > 0,
});

useEffect(() => {
if (
!Number.isInteger(workspaceId) ||
workspaceId <= 0
) {
return;
}

setWorkspaceID(workspaceId);

}, [workspaceId, setWorkspaceID]);

useEffect(() => {
if (
!Number.isInteger(boardId) ||
boardId <= 0
) {
return;
}

setBoard(boardId);

}, [boardId, setBoard]);

useEffect(() => {
if (
!Number.isInteger(workspaceId) ||
workspaceId <= 0 ||
!workspaces.length
) {
return;
}

const currentWorkspace = workspaces.find(
  (item: Workspace) => item.id === workspaceId,
);

if (!currentWorkspace) {
  return;
}

setWorkspace(currentWorkspace);

setWorkspaceRole(
  (currentWorkspace as any).role ??
    (currentWorkspace as any).member?.role ??
    "",
);

}, [
workspaceId,
workspaces,
setWorkspaceRole,
]);

useEffect(() => {
if (
!Number.isInteger(boardId) ||
boardId <= 0 ||
!boards.length
) {
return;
}

const currentBoard = boards.find(
  (board: any) => board.id === boardId,
);

if (!currentBoard) {
  return;
}

setBoardRole(currentBoard.role);

}, [
boardId,
boards,
setBoardRole,
]);

const handleWorkspaceChange = async (
selectedWorkspace: Workspace,
) => {
setWorkspace(selectedWorkspace);
setWorkspaceID(selectedWorkspace.id);

try {
  const workspaceBoards = await getBoards(
    selectedWorkspace.id,
  );

  if (workspaceBoards.length > 0) {
    const firstBoard = workspaceBoards[0];

    setBoard(firstBoard.id);
    setBoardRole(firstBoard.role);

    router.push(
      `/workspace/${selectedWorkspace.id}/board/${firstBoard.id}`,
    );

    return;
  }

  router.push(
    `/workspace/${selectedWorkspace.id}`,
  );
} catch {
  router.push(
    `/workspace/${selectedWorkspace.id}`,
  );
}

};

const handleBoardChange = (board: any) => {
setBoard(board.id);
setBoardRole(board.role);

router.push(
  `/workspace/${workspaceId}/board/${board.id}`,
);

};

return (
<div className="relative flex h-full select-none flex-col border-r border-gray-200 bg-white">
<div
className={cn(
"flex h-full flex-col overflow-hidden bg-gray-50/50 transition-all duration-300 ease-in-out",
isOpen ? "w-[270px]" : "w-0",
)}
>
<div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
<span className="text-sm font-bold tracking-tight text-gray-700">
Workspace
</span>

      <div className="flex items-center gap-1.5">
        {workspace?.id && (
          <ManageWorkspaceDropDown
            workspaceId={workspace.id}
          />
        )}

        <button className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800">
          <Search className="h-4.5 w-4.5" />
        </button>

        <button
          onClick={onToggle}
          className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>

    <div className="flex items-center gap-2.5 px-4 py-5">
      <WorkspaceSwitcher
        workspaces={workspaces}
        workspace={workspace}
        onWorkspaceChange={
          handleWorkspaceChange
        }
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Create workspace or board"
          >
            <Plus className="h-4.5 w-4.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-max"
        >
          <DropdownMenuItem
            onClick={() =>
              setIsCreateWorkspaceOpen(true)
            }
          >
            <Building2 className="mr-2 h-4 w-4" />
            Create Workspace
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              setIsCreateBoardOpen(true)
            }
            disabled={!workspace}
          >
            <Kanban className="mr-2 h-4 w-4" />
            Create Board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div>
        <button
          onClick={() =>
            setIsContentExpanded(
              !isContentExpanded,
            )
          }
          className="flex w-full items-center justify-between px-2 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
        >
          <span>Content</span>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transform transition-transform duration-200",
              !isContentExpanded &&
                "-rotate-90",
            )}
          />
        </button>

        {isContentExpanded && (
          <div className="mt-2 flex flex-col gap-1.5">
            {isBoardsLoading ? (
              <div className="px-3.5 py-2.5 text-xs text-gray-400">
                Loading boards...
              </div>
            ) : boards.length > 0 ? (
              boards.map((item: any) => {
                const isActive =
                  boardId === item.id;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex w-full items-center justify-between gap-2 rounded-md px-3.5 py-2.5 text-left text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100",
                      isActive &&
                        "bg-blue-50 font-semibold text-blue-600 shadow-sm hover:bg-blue-100",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleBoardChange(item)
                      }
                      className="flex-1 truncate text-left"
                    >
                      {item.name}
                    </button>

                    {(item.role === "OWNER" ||
                      item.role === "ADMIN") &&
                      workspace && (
                        <ManageBoardDropdown
                          boardId={item.id}
                          boardName={item.name}
                          workspaceId={
                            workspace.id
                          }
                        />
                      )}
                  </div>
                );
              })
            ) : (
              <div className="px-3.5 py-2.5 text-xs text-gray-400">
                No boards found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>

  {!isOpen && (
    <button
      onClick={onToggle}
      className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow hover:bg-gray-50 hover:text-gray-800"
    >
      <ChevronRight className="h-3 w-3" />
    </button>
  )}

  <CreateWorkspaceModal
    isOpen={isCreateWorkspaceOpen}
    onClose={() =>
      setIsCreateWorkspaceOpen(false)
    }
  />

  {workspace && (
    <CreateBoardModal
      isOpen={isCreateBoardOpen}
      onClose={() =>
        setIsCreateBoardOpen(false)
      }
      workspaceId={workspace.id}
    />
  )}
</div>
);
}