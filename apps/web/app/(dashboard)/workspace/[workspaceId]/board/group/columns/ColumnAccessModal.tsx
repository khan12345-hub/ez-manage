"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import {
  removeColumnPermission,
  updateColumnPermission,
} from "@/services/columns.api";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
  columnId: number;
  permissions: ColumnPermission[];
  members: BoardMember[];
}

export function ColumnAccessDialog({
  open,
  onOpenChange,
  boardId,
  columnId,
  permissions,
  members,
}: Props) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  const permittedUserIds = useMemo(() => {
    return new Set(
      permissions
        .filter((permission) => permission.canEdit)
        .map((permission) => permission.userId),
    );
  }, [permissions]);

  const filteredMembers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return members;
    }

    return members.filter((member) => {
      const name =
        `${member.user.firstName} ${member.user.lastName}`.toLowerCase();

      return name.includes(value);
    });
  }, [members, search]);

  const permissionMutation = useMutation({
    mutationFn: async ({
      userId,
      canEdit,
    }: {
      userId: number;
      canEdit: boolean;
    }) => {
      if (canEdit) {
        return updateColumnPermission(
          boardId,
          columnId,
          userId,
          true,
        );
      }

      return removeColumnPermission(
        boardId,
        columnId,
        userId,
      );
    },

    onSuccess: (_, variables) => {
      toast.success(
        variables.canEdit
          ? "User added to column access"
          : "User removed from column access",
      );

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },

    onError: () => {
      toast.error("Failed to update column access");
    },
  });

  const handleUserClick = (userId: number) => {
    if (permissionMutation.isPending) {
      return;
    }

    permissionMutation.mutate({
      userId,
      canEdit: !permittedUserIds.has(userId),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="w-[380px] gap-0 p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Choose who can edit this column
          </DialogTitle>

          <DialogDescription className="text-xs">
            Only selected people can change cells in this column.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Enter a person's name"
              className="pl-9"
            />
          </div>
        </div>

        <div className="border-t" />

        {filteredMembers && <div className="max-h-72 overflow-y-auto p-2">
          {filteredMembers.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No people found
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isAllowed = permittedUserIds.has(
                member.user.id,
              );

              return (
                <button
                  key={member.user.id}
                  type="button"
                  disabled={permissionMutation.isPending}
                  onClick={() =>
                    handleUserClick(member.user.id)
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      `${member.user.firstName?.[0] ?? ""}${member.user.lastName?.[0] ?? ""}`
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {member.user.firstName}{" "}
                      {member.user.lastName}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {member.role}
                    </div>
                  </div>

                  {isAllowed && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>}
      </DialogContent>
    </Dialog>
  );
}