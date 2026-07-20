"use client";

import React, { useEffect, useState } from "react";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Home,
  ChevronDown,
  BookOpen,
  ClipboardList,
  FolderOpen,
  Settings,
  Bot,
  Kanban,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getAllWorkspaces } from "@/services/workspace.api";
import type { Workspace } from "@repo/shared";
import { AppSelect } from "@/components/ui/AppSelect";
import { getBoards } from "@/services/boards.api";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { CreateBoardModal } from "@/components/CreateBoardModal";
import { ManageWorkspaceDropDown } from "./ManageWorkspace";
import { ManageBoardDropdown } from "./ManageBoard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import Link from "next/link";
import { useInviteModalStore } from "@/store/invite-modal";
interface SecondarySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeItem?: string;
  onSelectItem?: (item: string) => void;
}

export function SecondarySidebar({
  isOpen,
  onToggle,
  activeItem = "Developer testing board",
  onSelectItem,
}: SecondarySidebarProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isContentExpanded, setIsContentExpanded] = useState(true);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getAllWorkspaces,
    retry: false,
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["boards", workspace?.id],
    queryFn: () => getBoards(workspace?.id),
    enabled: !!workspace?.id,
  });
  // write tanstack query to get all workspaces
  useEffect(()=>{
    if(workspaces.length > 0){
      setWorkspace(workspaces[0])
    }
  },[workspaces])
  const { setBoard } = useInviteModalStore();
  console.log("ROLE", boards)
  return (
    <div className="relative flex h-full select-none flex-col border-r border-gray-200 bg-white">
      {/* Secondary Sidebar Content Container */}
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden bg-gray-50/50 transition-all duration-300 ease-in-out",
          isOpen ? "w-[270px]" : "w-0",
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
          <span className="text-sm font-bold text-gray-700 tracking-tight">
            Workspace
          </span>
          <div className="flex items-center gap-1.5">
            {/* <button className="rounded p-1.5 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
              <MoreHorizontal className="h-4.5 w-4.5" />
            </button> */}
            {workspace?.id && (
              <ManageWorkspaceDropDown workspaceId={workspace.id} />
            )}
            <button className="rounded p-1.5 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
              <Search className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={onToggle}
              className="rounded p-1.5 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Workspace Dropdown Selector */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          {/* <AppSelect
            options={workspaces}
            value={workspace?.id}
            valueField="id"
            labelField="name"
            placeholder="Select workspace"
            onChange={(_, selectedWorkspace: Workspace) => {
              setWorkspace(selectedWorkspace);
            }}
          /> */}
          <WorkspaceSwitcher
            workspaces={workspaces}
            workspace={workspace}
            onWorkspaceChange={(selectedWorkspace) => {
              setWorkspace(selectedWorkspace);
              
            }}
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
            <DropdownMenuContent align="end" className="w-max">
              <DropdownMenuItem onClick={() => setIsCreateWorkspaceOpen(true)}>
                <Building2 className="mr-2 h-4 w-4" />
                Create Workspace
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsCreateBoardOpen(true)}
                disabled={!workspace}
              >
                <Kanban className="mr-2 h-4 w-4" />
                Create Board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* Content Collapsible Group */}
          <div>
            <button
              onClick={() => setIsContentExpanded(!isContentExpanded)}
              className="flex w-full items-center justify-between px-2 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
            >
              <span>Content</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transform transition-transform duration-200",
                  !isContentExpanded && "-rotate-90",
                )}
              />
            </button>

            {isContentExpanded && (
              <div className="mt-2 flex flex-col gap-1.5">
                {boards.length > 0 &&
                  boards.map((item: any) => {
                    // const Icon = item.icon;
                    const isActive = activeItem === item.id;
                    return (
                      <div
                        key={item.name}
                        className={cn(
                          "group flex w-full items-center justify-between gap-2 rounded-md px-3.5 py-2.5 text-left text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors duration-150",
                          isActive &&
                            "bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold shadow-sm",
                        )}
                      >
                        <Link
                          href={`/board/${item.id}`}
                          onClick={() => {
                            onSelectItem?.(item.id),
                            setBoard(item.id)
                          }}
                          className="flex-1 truncate text-left"
                        >
                          {item.name}
                        </Link>
                        {(item.role === "OWNER" || item.role === "ADMIN") && workspace && (
                          <ManageBoardDropdown
                            boardId={item.id}
                            boardName={item.name}
                            workspaceId={workspace.id}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapse toggle handle floating on the border */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow hover:bg-gray-50 text-gray-500 hover:text-gray-800"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
      />

      {workspace && (
        <CreateBoardModal
          isOpen={isCreateBoardOpen}
          onClose={() => setIsCreateBoardOpen(false)}
          workspaceId={workspace.id}
        />
      )}
    </div>
  );
}
