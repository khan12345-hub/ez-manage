"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import {
  deleteColumn,
  updateColumnAccess,
} from "@/services/columns.api";

import { ColumnAccessDialog } from "./ColumnAccessModal";
import { useAuth } from "@/providers/AuthProvider";

interface BoardMember {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  role: string;
}

interface ColumnPermission {
  userId: number;
  canEdit: boolean;
}

interface Props {
  column: {
    id: number;
    isPrimary?: boolean;
    accessControlEnabled?: boolean;
    permissions?: ColumnPermission[];
  };
  members: BoardMember[];
}

export function ColumnActions({
  column,
  members,
}: Props) {
  const queryClient = useQueryClient();
  const params = useParams();
  const { user } = useAuth();

  const boardId = Number(params.boardId);

  const [accessOpen, setAccessOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteColumn(column.id),

    onSuccess: () => {
      toast.success("Column deleted");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
      toast.error("Failed to delete column");
    },
  });

  const accessMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateColumnAccess(
        boardId,
        column.id,
        enabled,
      ),

    onSuccess: (_, enabled) => {
      toast.success(
        enabled
          ? "Column protection enabled"
          : "Column protection disabled",
      );

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
      toast.error("Failed to update column protection");
    },
  });

  const isProtected = Boolean(
    column.accessControlEnabled,
  );

  /**
   * SUPER_ADMIN can manage column protection.
   */
  const isSuperAdmin =
    user?.systemRole === "SUPER_ADMIN";

  /**
   * Board OWNER can manage column protection.
   */
  const isBoardOwner = members.some(
    (member) =>
      member.role === "OWNER" &&
      member.user.id === user?.id,
  );

  /**
   * Only SUPER_ADMIN and board OWNER can
   * manage column protection.
   */
  const canManageColumnProtection =
    isSuperAdmin || isBoardOwner;

  /**
   * Check explicit column edit permission.
   */
  const hasColumnEditAccess =
    column.permissions?.some(
      (permission) =>
        permission.userId === user?.id &&
        permission.canEdit,
    ) ?? false;

  /**
   * Delete is allowed when:
   *
   * - Column is not protected
   * - User is SUPER_ADMIN
   * - User is board OWNER
   * - User has explicit column edit access
   */
  const canDeleteColumn =
    !isProtected ||
    isSuperAdmin ||
    isBoardOwner ||
    hasColumnEditAccess;

  /**
   * Primary columns cannot be deleted.
   */
  const canShowDelete =
    canDeleteColumn && !column.isPrimary;

  /**
   * Show the three-dot menu only when there
   * is at least one actual action available.
   */
  const hasActions =
    canManageColumnProtection || canShowDelete;

  if (!hasActions) {
    return null;
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-52"
        >
          {/* Protection controls */}
          {canManageColumnProtection && (
            <>
              <DropdownMenuItem
                disabled={
                  column.isPrimary ||
                  accessMutation.isPending ||
                  isProtected
                }
                onClick={() =>
                  accessMutation.mutate(true)
                }
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Enable protection
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={
                  column.isPrimary ||
                  accessMutation.isPending ||
                  !isProtected
                }
                onClick={() =>
                  accessMutation.mutate(false)
                }
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                Disable protection
              </DropdownMenuItem>

              {isProtected && (
                <DropdownMenuItem
                  disabled={column.isPrimary}
                  onSelect={(event) => {
                    event.preventDefault();
                    setAccessOpen(true);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage access
                </DropdownMenuItem>
              )}
            </>
          )}

          {/* Delete */}
          {canShowDelete && (
            <DropdownMenuItem
              disabled={
                deleteMutation.isPending ||
                accessMutation.isPending
              }
              className="text-destructive focus:text-destructive"
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Column access dialog */}
      {canManageColumnProtection && (
        <ColumnAccessDialog
          open={accessOpen}
          onOpenChange={setAccessOpen}
          boardId={boardId}
          columnId={column.id}
          permissions={column.permissions ?? []}
          members={members}
        />
      )}
    </div>
  );
}