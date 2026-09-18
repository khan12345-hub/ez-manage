"use client";

import { Bot, ChevronDown, MoreHorizontal, Users } from "lucide-react";
import { useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";

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
import { ActiveTimerBadge } from "./ActiveTimerBadge";
import { usePermissions } from "@/services/permissions/permissions.hooks";
import { BoardActivityPanel } from "./BoardActivityPanel";
import { useAuth } from "@/providers/AuthProvider";

interface BoardHeaderProps {
  board: any;
}

export function BoardHeader({ board }: BoardHeaderProps) {
  const queryClient = useQueryClient();

  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const { user } = useAuth();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

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
      role: "MEMBER" | "ADMIN" | "VIEWER";
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
      <header className="flex h-16 w-full items-center justify-between gap-2 bg-background">
        {/* Board name */}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className="truncate text-xl font-semibold capitalize tracking-[-0.02em] sm:text-2xl">
            {board.name}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Activity log avatar button */}
          <button
            type="button"
            onClick={() => setActivityOpen(true)}
            title="Board activity log"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white transition-all hover:ring-2 hover:ring-orange-400 hover:ring-offset-1"
          >
            {user?.avatarUrl && !avatarError ? (
              <img
                src={`${BASE_URL}${user.avatarUrl}`}
                alt={initials}
                className="h-9 w-9 rounded-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              initials
            )}
          </button>

          <ActiveTimerBadge />

          {/* Automate — text on sm+, icon-only on mobile */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden h-9 gap-2 px-3 font-normal sm:inline-flex"
            onClick={() => setOpen(!open)}
          >
            <Bot className="h-4 w-4" />
            Automate
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:hidden"
            title="Automate"
            onClick={() => setOpen(!open)}
          >
            <Bot className="h-4 w-4" />
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

      <BoardActivityPanel
        board={board}
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
      />
    </>
  );
}
