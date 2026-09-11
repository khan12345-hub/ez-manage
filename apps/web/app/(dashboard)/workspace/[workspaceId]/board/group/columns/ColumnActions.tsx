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
import { getErrorMessage } from "@/lib/error-message";
import { useState } from "react";

import { deleteColumn, updateColumnAccess } from "@/services/columns.api";

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

export function ColumnActions({ column, members }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const params = useParams();

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

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete column"));
    },
  });

  const accessMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateColumnAccess(boardId, column.id, enabled),

    onSuccess: (_, enabled) => {
      toast.success(
        enabled ? "Column protection enabled" : "Column protection disabled",
      );

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update column protection"));
    },
  });

  /**
   * SUPER_ADMIN can manage column protection.
   */

  /**
   * Board OWNER can manage column protection.
   */
  const isProtected = Boolean(column.accessControlEnabled);
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";
  const currentMember = (members ?? []).find((m) => m.user.id === user?.id);
  const isBoardOwnerOrAdmin =
    currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";

  const canManageColumnProtection = isSuperAdmin || isBoardOwnerOrAdmin;

  const hasColumnEditAccess =
    column.permissions?.some(
      (permission) => permission.userId === user?.id && permission.canEdit,
    ) ?? false;

  const canDeleteColumn =
    !isProtected || isSuperAdmin || isBoardOwnerOrAdmin || hasColumnEditAccess;

  /**
   * Primary columns cannot be deleted.
   */
  const canShowDelete = canDeleteColumn && !column.isPrimary;

  /**
   * Show the three-dot menu only when there
   * is at least one actual action available.
   */
  const hasActions = canManageColumnProtection || canShowDelete;

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

        <DropdownMenuContent align="end" className="w-52">
          {/* Protection controls */}
          {canManageColumnProtection && (
            <>
              {isProtected ? (
                <DropdownMenuItem
                  disabled={column.isPrimary || accessMutation.isPending}
                  onClick={() => accessMutation.mutate(false)}
                  className="cursor-pointer"
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Disable protection
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={column.isPrimary || accessMutation.isPending}
                  onClick={() => accessMutation.mutate(true)}
                  className="cursor-pointer"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Enable protection
                </DropdownMenuItem>
              )}

              {isProtected && (
                <DropdownMenuItem
                  disabled={column.isPrimary}
                  onSelect={(event) => {
                    event.preventDefault();
                    setAccessOpen(true);
                  }}
                  className="cursor-pointer"
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
              disabled={deleteMutation.isPending || accessMutation.isPending}
              className="cursor-pointer text-destructive focus:text-destructive"
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
