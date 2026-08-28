"use client";

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
  /*
   * IMPORTANT:
   * Subscribe to the actual group in Zustand.
   *
   * The `group` prop may be stale because it can come from
   * React Query / board API data.
   */
  const currentGroup = useGroupStore((state) =>
    state.groups.find((item) => item.id === group.id),
  );

  const updateGroup = useGroupStore((state) => state.updateGroup);
  const removeGroup = useGroupStore((state) => state.removeGroup);

  const { boardId } = useInviteModalStore();

  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * Fallback to prop while Zustand is initializing.
   */
  const activeGroup = currentGroup ?? group;

  useEffect(() => {
    if (activeGroup.isNew && inputRef.current) {
      inputRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [activeGroup.isNew, focusToken]);

  /*
   * Create group
   */
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
      /*
       * IMPORTANT:
       * Replace temporary group ID with real backend ID.
       */
      updateGroup(activeGroup.id, {
        id: newGroup.id,
        name: newGroup.name,
        color: newGroup.color,
        isNew: false,
        isEditing: false,
      });
    },
  });

  /*
   * Update group
   */
  const updateMutation = useMutation({
    mutationFn: ({
      boardId,
      groupId,
      name,
      color,
    }: {
      boardId: number;
      groupId: number;
      name?: string;
      color?: string;
    }) =>
      updateGroupApi(boardId, groupId, {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
      }),

    onSuccess: (updatedGroup, variables) => {
      /*
       * Keep Zustand synchronized with the backend.
       */
      updateGroup(variables.groupId, {
        ...(updatedGroup?.name !== undefined
          ? { name: updatedGroup.name }
          : variables.name !== undefined
            ? { name: variables.name }
            : {}),

        ...(updatedGroup?.color !== undefined
          ? { color: updatedGroup.color }
          : variables.color !== undefined
            ? { color: variables.color }
            : {}),
      });
    },
  });

  const handleColorChange = (color: string) => {
    /*
     * Optimistic UI update.
     * Because activeGroup comes from Zustand, this immediately
     * rerenders the ColorPicker and button.
     */
    updateGroup(activeGroup.id, {
      color,
    });

    if (activeGroup.isNew || !boardId) {
      return;
    }

    updateMutation.mutate({
      boardId,
      groupId: Number(activeGroup.id),
      color,
    });
  };

  const handleNameChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    /*
     * Update Zustand on every keystroke.
     */
    updateGroup(activeGroup.id, {
      name: event.target.value,
    });
  };

  const handleNameBlur = () => {
    if (!boardId) return;

    const name = activeGroup.name.trim();

    /*
     * Remove empty temporary group.
     */
    if (!name) {
      if (activeGroup.isNew) {
        removeGroup(activeGroup.id);
      } else {
        updateGroup(activeGroup.id, {
          isEditing: false,
        });
      }

      return;
    }

    /*
     * Create temporary group.
     */
    if (activeGroup.isNew) {
      createMutation.mutate({
        boardId,
        data: {
          name,
          color: activeGroup.color ?? undefined,
        },
      });

      return;
    }

    /*
     * Save existing group.
     */
    updateMutation.mutate({
      boardId,
      groupId: Number(activeGroup.id),
      name,
    });
  };

  return (
    <div className="flex items-center justify-between border-b p-3">
      <div className="flex items-center gap-3">
        <ColorPicker
          value={activeGroup.color ?? undefined}
          colors={STATUS_COLORS}
          onChange={handleColorChange}
        >
          <button
            type="button"
            className="h-8 w-8 shrink-0 rounded-md border transition hover:scale-105"
            style={{
              backgroundColor: activeGroup.color ?? undefined,
            }}
            aria-label="Change group color"
          />
        </ColorPicker>

        <Input
          ref={inputRef}
          value={activeGroup.name ?? ""}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          className="w-64 border-none p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          style={{
            color: activeGroup.color ?? undefined,
          }}
        />
      </div>
    </div>
  );
}

