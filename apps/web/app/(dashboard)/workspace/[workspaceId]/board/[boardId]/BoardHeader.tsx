"use client";

import { Bot, ChevronDown, MoreHorizontal, Users } from "lucide-react";
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  BoardVisibility,
} from "@/services/board-access-management.api";

import { ManageBoardAccessModal } from "./ManageBoardAccessModal";
import AutomationModal from "./Automation/AutomationModal";
import { usePermissions } from "@/services/permissions/permissions.hooks";

interface BoardHeaderProps {
  board: any;
}

export function BoardHeader({ board }: BoardHeaderProps) {
  const queryClient = useQueryClient();

  const [manageAccessOpen, setManageAccessOpen] = useState(false);

  const [open, setOpen] = useState(false);

  /**
   * Update board visibility
   */
  const visibilityMutation = useMutation({
    mutationFn: (visibility: BoardVisibility) =>
      updateBoardVisibility(board.id, visibility),

    onMutate: async (newVisibility) => {
      await queryClient.cancelQueries({
        queryKey: ["board", board.id],
      });

      const previousBoard = queryClient.getQueryData(["board", board.id]);

      queryClient.setQueryData(["board", board.id], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          visibility: newVisibility,
        };
      });

      return { previousBoard };
    },

    onError: (_error, _newVisibility, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(["board", board.id], context.previousBoard);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", board.id],
      });
    },
  });

  /**
   * Update board member role
   */
  const roleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: number;
      role: "MEMBER" | "ADMIN";
    }) => updateBoardMemberRole(board.id, memberId, role),

    onMutate: async ({ memberId, role }) => {
      await queryClient.cancelQueries({
        queryKey: ["board", board.id],
      });

      const previousBoard = queryClient.getQueryData(["board", board.id]);

      /**
       * Optimistically update the exact cache
       * that BoardHeader uses to render members.
       */
      queryClient.setQueryData(["board", board.id], (old: any) => {
        if (!old) return old;

        return {
          ...old,

          members: (old.members ?? []).map((member: any) =>
            member.id === memberId
              ? {
                  ...member,
                  role,
                }
              : member,
          ),
        };
      });

      return { previousBoard };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(["board", board.id], context.previousBoard);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", board.id],
      });
    },
  });

  /**
   * Remove board member
   */
  const removeMutation = useMutation({
    mutationFn: (memberId: number) => removeBoardMember(board.id, memberId),

    onMutate: async (memberId) => {
      await queryClient.cancelQueries({
        queryKey: ["board", board.id],
      });

      const previousBoard = queryClient.getQueryData(["board", board.id]);

      /**
       * Remove member immediately from the UI.
       */
      queryClient.setQueryData(["board", board.id], (old: any) => {
        if (!old) return old;

        return {
          ...old,

          members: (old.members ?? []).filter(
            (member: any) => member.id !== memberId,
          ),
        };
      });

      return { previousBoard };
    },

    onError: (_error, _memberId, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(["board", board.id], context.previousBoard);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", board.id],
      });
    },
  });

  const { canManageBoard } = usePermissions();

  return (
    <>
      <header className="flex h-16 w-full items-center justify-between bg-background">
        {/* Board name */}
        <button type="button" className="flex items-center gap-1.5 text-left">
          <span className="text-2xl font-semibold capitalize tracking-[-0.02em]">
            {board.name}
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
            onClick={() => setOpen(!open)}
          >
            <Bot className="h-4 w-4" />
            Automate
          </Button>
          {canManageBoard(board.role === "OWNER") && (
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

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setManageAccessOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Manage access
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <ManageBoardAccessModal
        open={manageAccessOpen}
        onOpenChange={setManageAccessOpen}
        boardName={board.name}
        visibility={board?.visibility ?? "PRIVATE"}
        members={board?.members ?? []}
        onVisibilityChange={(visibility) =>
          visibilityMutation.mutate(visibility)
        }
        onRoleChange={(memberId, role) => {
          roleMutation.mutate({
            memberId,
            role,
          });
        }}
        isRoleUpdating={roleMutation.isPending}
        onRemoveMember={(memberId) => removeMutation.mutate(memberId)}
        isVisibilityUpdating={visibilityMutation.isPending}
        isRemovingMember={removeMutation.isPending}
      />

      <AutomationModal
        open={open}
        onOpenChange={setOpen}
        boardName={board.name}
        columns={board.columns}
        groups={board.groups}
      />
    </>
  );
}
