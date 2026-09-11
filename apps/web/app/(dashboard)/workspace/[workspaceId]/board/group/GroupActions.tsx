"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { updateGroup, deleteGroup } from "@/services/groups.api";
import { useGroupStore } from "@/store/create-group-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { STATUS_COLORS } from "@/constants/colors";

interface Props {
  group: any;
}

export function GroupActions({ group }: Props) {
  const queryClient = useQueryClient();

  const updateLocal = useGroupStore((s) => s.updateGroup);
  const removeLocal = useGroupStore((s) => s.removeGroup);

  const { boardId } = useInviteModalStore();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        boardId: number;
        name?: string;
        color?: string;
      };
    }) => updateGroup(boardId, id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      id,
      boardId,
    }: {
      id: number;
      boardId: number;
    }) => deleteGroup(id, boardId),

    onSuccess: (_, variables) => {
      removeLocal(variables.id);

      queryClient.invalidateQueries({
        queryKey: ["board"],
      });
    },
  });

  const handleDeleteClick = () => {
    if (group.isNew) {
      removeLocal(group.id);
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!boardId) return;

    deleteMutation.mutate({
      id: group.id,
      boardId,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() =>
              updateLocal(group.id, {
                isEditing: true,
              })
            }
          >
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>

          <div className="space-y-2 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Group Color
            </p>

            <ColorPicker
              value={group.color}
              colors={STATUS_COLORS}
              onChange={(color) => {
                updateLocal(group.id, { color });

                if (!group.isNew && boardId) {
                  updateMutation.mutate({
                    id: group.id,
                    data: {
                      boardId,
                      color,
                    },
                  });
                }
              }}
            >
              <button
                type="button"
                className="h-8 w-8 rounded-md border transition hover:scale-105"
                style={{
                  backgroundColor: group.color,
                }}
                aria-label="Change group color"
              />
            </ColorPicker>
          </div>

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleDeleteClick}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <Trash2 className="size-5 text-destructive" />
            </AlertDialogMedia>

            <div>
              <AlertDialogTitle className="text-base">
                Delete group?
              </AlertDialogTitle>

              <AlertDialogDescription className="mt-1">
                <span className="flex items-center gap-1.5 mb-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: group.color ?? "#ccc" }}
                  />
                  <span className="font-medium text-foreground text-sm">
                    {group.name}
                  </span>
                </span>
                All tasks inside this group will be permanently deleted.
                This cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 gap-1.5"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete group
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
