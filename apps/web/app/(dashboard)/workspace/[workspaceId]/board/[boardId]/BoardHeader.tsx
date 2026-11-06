"use client";

import { Bot, ChevronDown, MoreHorizontal, Plus, Settings, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolveUrl } from "@/lib/resolveUrl";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBoardTimeSummary } from "@/services/time-tracking.api";
import { cn } from "@/lib/utils";

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
  updateMemberGroupAccess,
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

  // Measure the sticky banner height → expose as a CSS var so the view-tabs and
  // toolbar can offset their own sticky positions below it (robust to any height).
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const setVar = () =>
      document.documentElement.style.setProperty(
        "--ez-board-banner-h",
        `${el.offsetHeight}px`,
      );
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Update board visibility
   */
  const visibilityMutation = useMutation({
    mutationFn: (visibility: BoardVisibility) =>
      updateBoardVisibility(board.id, visibility),

    onMutate: async (newVisibility) => {
      await queryClient.cancelQueries({
        queryKey: ["board", board.uid],
      });

      const previousBoard = queryClient.getQueryData(["board", board.uid]);

      queryClient.setQueryData(["board", board.uid], (old: any) => {
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
        queryClient.setQueryData(["board", board.uid], context.previousBoard);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", board.uid],
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
        queryKey: ["board", board.uid],
      });

      const previousBoard = queryClient.getQueryData(["board", board.uid]);

      queryClient.setQueryData(["board", board.uid], (old: any) => {
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
        queryClient.setQueryData(["board", board.uid], context.previousBoard);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", board.uid],
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
        queryKey: ["board", board.uid],
      });

      const previousBoard = queryClient.getQueryData(["board", board.uid]);

      queryClient.setQueryData(["board", board.uid], (old: any) => {
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
        queryClient.setQueryData(["board", board.uid], context.previousBoard);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", board.uid],
      });
    },
  });

  /**
   * Update member group access
   */
  const groupAccessMutation = useMutation({
    mutationFn: ({
      memberId,
      accessAllGroups,
      groupIds,
    }: {
      memberId: number;
      accessAllGroups: boolean;
      groupIds?: number[];
    }) => updateMemberGroupAccess(board.id, memberId, accessAllGroups, groupIds),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["board", board.uid] });
    },
  });

  const { canManageBoard } = usePermissions();

  const { data: timeSummary } = useQuery({
    queryKey: ["board-time-summary", board.id],
    queryFn: () => getBoardTimeSummary(board.id),
    enabled: !!board.budgetHours,
    refetchInterval: 60_000,
  });

  const budgetPct = timeSummary?.percentage ?? 0;
  const budgetColor =
    budgetPct >= 100 ? "bg-destructive" :
    budgetPct >= 80  ? "bg-orange-500" :
    "bg-emerald-500";

  return (
    <>
      <div
        ref={bannerRef}
        className="relative -mx-3 -mt-3 overflow-hidden border-b border-border bg-card px-3 pb-3.5 pt-3 sm:-mx-6 sm:-mt-6 sm:px-6"
      >
        {/* Ledger rule: thin emerald → brass hairline across the top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, var(--primary) 0%, var(--brass) 60%, transparent 100%)" }}
          aria-hidden
        />

        {/* breadcrumb */}
        <nav
          className="relative mb-1 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-product-boards" aria-hidden />
          Boards
          {board?.workspace?.name && (
            <>
              <span aria-hidden>/</span>
              <span className="truncate normal-case tracking-normal">{board.workspace.name}</span>
            </>
          )}
        </nav>

        <header className="relative flex w-full items-center justify-between gap-2">
        {/* Board name + budget */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <button type="button" className="flex min-w-0 items-center gap-1.5 text-left">
            <span className="truncate font-serif text-[26px] font-normal leading-tight tracking-tight sm:text-[32px]">
              {board.name}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          {board.budgetHours && timeSummary && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-28 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", budgetColor)}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <span className={cn(
                "text-[10px] font-medium tabular-nums",
                budgetPct >= 100 ? "text-destructive" :
                budgetPct >= 80  ? "text-orange-500" :
                "text-muted-foreground",
              )}>
                {timeSummary.totalHours.toFixed(1)}h / {board.budgetHours}h
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Board Settings → Manage access */}
          {canManageBoard(board.role === "OWNER") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 font-medium sm:inline-flex"
              onClick={() => setManageAccessOpen(true)}
            >
              <Settings className="h-4 w-4" />
              Board Settings
            </Button>
          )}

          {/* New Task → triggers the board's create-task flow via event */}
          <Button
            type="button"
            size="sm"
            className="h-9 gap-2 border-0 bg-forest font-semibold text-forest-foreground shadow-sm hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("ez:create-task"))
            }
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>

          {/* Activity log avatar button */}
          <button
            type="button"
            onClick={() => setActivityOpen(true)}
            title="Board activity log"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-brass-soft ring-1 ring-brass/40 transition-all hover:ring-2 hover:ring-brass hover:ring-offset-1 hover:ring-offset-card"
          >
            {user?.avatarUrl && !avatarError ? (
              <img
                src={resolveUrl(user.avatarUrl)}
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

        {/* description + metadata */}
        {board?.description && (
          <p className="relative mt-1.5 max-w-2xl text-[13px] text-muted-foreground">
            {board.description}
          </p>
        )}
        {Array.isArray(board?.members) && (
          <div className="relative mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {board.members.length} {board.members.length === 1 ? "member" : "members"}
            </span>
          </div>
        )}
      </div>

      <ManageBoardAccessModal
        open={manageAccessOpen}
        onOpenChange={setManageAccessOpen}
        boardName={board.name}
        visibility={board?.visibility ?? "PRIVATE"}
        members={board?.members ?? []}
        groups={board?.groups ?? []}
        columns={board?.columns ?? []}
        onVisibilityChange={(visibility) =>
          visibilityMutation.mutate(visibility)
        }
        onRoleChange={(memberId, role) => {
          roleMutation.mutate({ memberId, role });
        }}
        onGroupAccessChange={(memberId, accessAllGroups, groupIds) =>
          groupAccessMutation.mutate({ memberId, accessAllGroups, groupIds })
        }
        isRoleUpdating={roleMutation.isPending}
        onRemoveMember={(memberId) => removeMutation.mutate(memberId)}
        isVisibilityUpdating={visibilityMutation.isPending}
        isRemovingMember={removeMutation.isPending}
        isGroupAccessUpdating={groupAccessMutation.isPending}
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
