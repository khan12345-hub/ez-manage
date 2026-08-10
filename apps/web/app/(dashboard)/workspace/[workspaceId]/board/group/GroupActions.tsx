"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

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

  return (
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
          onClick={() => {
            if (group.isNew) {
              removeLocal(group.id);
              return;
            }

            if (!boardId) return;

            deleteMutation.mutate({
              id: group.id,
              boardId,
            });
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

