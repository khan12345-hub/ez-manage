"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { GripVertical } from "lucide-react";
import { toast } from "sonner";

import { useInviteModalStore } from "@/store/invite-modal";

import {
  BoardColumnType,
  createColumn,
} from "@/services/columns.api";

import { ColumnTypeModal } from "./columns/AddColumnModal";
import { GroupHeader } from "./GroupHeader";
import { GroupActions } from "./GroupActions";
import { GroupTable } from "./GroupTable";

interface Props {
  group: any;
  columns: any[];
  dragHandleProps?: any;
  isDraggingGroup?: boolean;
  isDraggingTask?: boolean;
  selection: any;
  newTaskFocusToken?: number;
  newGroupFocusToken?: number;
  members: Array<{
    id: number;
    role: string;
    user: {
      id: number;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    userId: number;
  }>;
}

export function Group({
  group,
  columns,
  dragHandleProps,
  isDraggingGroup = false,
  isDraggingTask = false,
  selection,
  newTaskFocusToken = 0,
  newGroupFocusToken = 0,
  members,
}: Props) {
  const [open, setOpen] = useState(false);

  const { boardId } = useInviteModalStore();

  const queryClient = useQueryClient();

  const createColumnMutation = useMutation({
    mutationFn: (type: BoardColumnType) =>
      createColumn(boardId || 0, type),

    onSuccess: () => {
      toast.success("Column created");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      setOpen(false);
    },

    onError: () => {
      toast.error("Failed to create column");
    },
  });

  return (
    <>
      <div className="overflow-hidden">
        {group.isNew || group.isEditing ? (
          <GroupHeader
            group={group}
            focusToken={newGroupFocusToken}
          />
        ) : (
          <div className="group flex items-center justify-start gap-2 py-3">
            <button
              type="button"
              {...dragHandleProps}
              className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
              aria-label={`Drag group ${group.name}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <GroupActions group={group} />

            <span
              style={{
                color: group.color,
              }}
              className="font-semibold"
            >
              {group.name}
            </span>
          </div>
        )}

        {!isDraggingGroup && (
          <GroupTable
            group={group}
            columns={columns}
            selection={selection}
            isDraggingGroup={isDraggingGroup}
            isDraggingTask={isDraggingTask}
            showSelection={false}
            showHeaders
            showNewTaskRow
            showAddColumn={false}
            setOpen={setOpen}
            newTaskFocusToken={newTaskFocusToken}
            members={members}
          />
        )}
      </div>

      <ColumnTypeModal
        open={open}
        onOpenChange={setOpen}
        onSelect={(type) => {
          createColumnMutation.mutate(type);
        }}
      />
    </>
  );
}