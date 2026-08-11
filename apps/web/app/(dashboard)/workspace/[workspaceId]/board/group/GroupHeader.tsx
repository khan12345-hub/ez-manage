import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";

import { useGroupStore } from "@/store/create-group-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { STATUS_COLORS } from "@/constants/colors";

import {
  createGroup,
  updateGroup as updateGroupApi,
} from "@/services/groups.api";

interface Props {
  group: any;
  focusToken?: number;
}

export function GroupHeader({ group, focusToken = 0 }: Props) {
  const updateGroup = useGroupStore((s) => s.updateGroup);
  const removeGroup = useGroupStore((s) => s.removeGroup);

  const { boardId } = useInviteModalStore();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (group.isNew && inputRef.current) {
      inputRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [group.isNew, focusToken]);

  const createMutation = useMutation({
    mutationFn: ({
      boardId,
      data,
    }: {
      boardId: number;
      data: {
        name: string;
        color?: string;
      };
    }) => createGroup(boardId, data),

    onSuccess: (newGroup) => {
      updateGroup(group.id, {
        id: newGroup.id,
        name: newGroup.name,
        color: newGroup.color,
        isNew: false,
        isEditing: false,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      boardId,
      id,
      data,
    }: {
      boardId: number;
      id: number;
      data: {
        name?: string;
        color?: string;
      };
    }) => updateGroupApi(boardId, id, data),

    onSuccess: (_, variables) => {
      updateGroup(variables.id, {
        isEditing: false,
      });
    },
  });

  return (
    <div className="flex items-center justify-between border-b p-3">
      <div className="flex items-center gap-3">
        <ColorPicker
          value={group.color}
          colors={STATUS_COLORS}
          onChange={(color) => {
            // Update local state immediately
            updateGroup(group.id, { color });

            // Don't call API for a temporary group
            if (!group.isNew && boardId) {
              updateMutation.mutate({
                boardId,
                id: group.id,
                data: {
                  color,
                },
              });
            }
          }}
        >
          <button
            type="button"
            className="h-8 w-8 rounded-md border transition hover:scale-105"
            style={{ backgroundColor: group.color }}
            aria-label="Change group color"
          />
        </ColorPicker>

        <Input
          ref={inputRef}
          value={group.name}
          onChange={(e) =>
            updateGroup(group.id, {
              name: e.target.value,
            })
          }
          className="w-64 border-none p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          style={{ color: group.color }}
          onBlur={(e) => {
            if (!boardId) return;

            const name = e.target.value.trim();

            // Remove empty temporary group
            if (!name) {
              if (group.isNew) {
                removeGroup(group.id);
              } else {
                updateGroup(group.id, {
                  isEditing: false,
                });
              }

              return;
            }

            // Create new group
            if (group.isNew) {
              createMutation.mutate({
                boardId,
                data: {
                  name,
                  color: group.color,
                },
              });

              return;
            }

            // Update existing group
            updateMutation.mutate({
              boardId,
              id: group.id,
              data: {
                name,
              },
            });
          }}
        />
      </div>
    </div>
  );
}
