import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";

import { useGroupStore } from "@/store/create-group-store";
import { useInviteModalStore } from "@/store/invite-modal";

import {
  createGroup,
  updateGroup as updateGroupApi,
} from "@/services/groups.api";

interface Props {
  group: any;
}

export function GroupHeader({ group }: Props) {
  const updateGroup = useGroupStore((s) => s.updateGroup);
  const removeGroup = useGroupStore((s) => s.removeGroup);

  const { boardId } = useInviteModalStore();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (group.isNew) {
      inputRef.current?.focus();
    }
  }, [group.isNew]);

  const createMutation = useMutation({
    mutationFn: createGroup,

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
      id,
      data,
    }: {
      id: number;
      data: {
        boardId: number;
        name?: string;
        color?: string;
      };
    }) => updateGroupApi(id, data),

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
          onChange={(color) => {
            updateGroup(group.id, { color });

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
        />

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

            if (group.isNew) {
              createMutation.mutate({
                boardId,
                name,
                color: group.color,
              });
            } else {
              updateMutation.mutate({
                id: group.id,
                data: {
                  boardId,
                  name,
                },
              });
            }
          }}
        />
      </div>
    </div>
  );
}