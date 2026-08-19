"use client";

import {
  Bot,
  ChevronDown,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { useState } from "react";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  updateBoardVisibility,
  updateBoardMemberRole,
  removeBoardMember,
} from "@/services/board-access-management.api";

import { ManageBoardAccessModal } from "./ManageBoardAccessModal";
import AutomationModal from "./Automation/AutomationModal";

interface BoardHeaderProps {
  boardId: number;
  boardName: string;
  columns: any;
  memberCount?: number;
  boardAccess?: any;
  groups?:any;
}

export function BoardHeader({
  boardId,
  boardName,
  columns,
  groups,
  memberCount = 0,
  boardAccess,
}: BoardHeaderProps) {
  const queryClient = useQueryClient();

  const [manageAccessOpen, setManageAccessOpen] =
    useState(false);

  const visibilityMutation = useMutation({
    mutationFn: (
      visibility: "PRIVATE" | "PUBLIC",
    ) =>
      updateBoardVisibility(
        boardId,
        visibility,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", boardId, "access"],
      });

      queryClient.invalidateQueries({
        queryKey: ["boards", boardId],
      });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: number;
      role: "MEMBER" | "ADMIN";
    }) =>
      updateBoardMemberRole(
        boardId,
        memberId,
        role,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", boardId, "access"],
      });

      queryClient.invalidateQueries({
        queryKey: ["boards", boardId],
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) =>
      removeBoardMember(
        boardId,
        memberId,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", boardId, "access"],
      });

      queryClient.invalidateQueries({
        queryKey: ["boards", boardId],
      });
    },
  });

   const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex h-16 w-full items-center justify-between bg-background px-6">
        {/* Board name */}
        <button
          type="button"
          className="flex items-center gap-1.5 text-left"
        >
          <span className="text-2xl font-semibold capitalize tracking-[-0.02em]">
            {boardName}
          </span>

          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-2 px-3 font-normal"
            onClick={()=>setOpen(!open)}
          >
            <Bot className="h-4 w-4" />
            Automate
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-1 h-9 w-9"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-48"
            >
              <DropdownMenuItem
                onClick={() =>
                  setManageAccessOpen(true)
                }
              >
                <Users className="mr-2 h-4 w-4" />
                Manage access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ManageBoardAccessModal
        open={manageAccessOpen}
        onOpenChange={setManageAccessOpen}
        boardName={boardName}
        visibility={
          boardAccess?.visibility ?? "PRIVATE"
        }
        members={
          boardAccess?.members ?? []
        }
        onVisibilityChange={(visibility) =>
          visibilityMutation.mutate(
            visibility,
          )
        }
        onRoleChange={(memberId, role) =>
          roleMutation.mutate({
            memberId,
            role,
          })
        }
        onRemoveMember={(memberId) =>
          removeMutation.mutate(memberId)
        }
        isVisibilityUpdating={
          visibilityMutation.isPending
        }
        isRoleUpdating={
          roleMutation.isPending
        }
        isRemovingMember={
          removeMutation.isPending
        }
      />
      <AutomationModal
          open={open}
          onOpenChange={setOpen}
          boardName={boardName}
          columns={columns}
          groups={groups}
        />
    </>
  );
}