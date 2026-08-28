"use client";

import { useState } from "react";

import { useInviteModalStore } from "@/store/invite-modal";

import { GroupTable } from "./GroupTable";
import { GroupHeader } from "./GroupHeader";
import { ColumnTypeModal } from "./columns/AddColumnModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BoardColumnType, createColumn } from "@/services/columns.api";
import { toast } from "sonner";

export function Group({
  group,
  columns,
  selection,
  newTaskFocusToken = 0,
  members,
  ...props
}: any) {
  const { boardId } = useInviteModalStore();

  const [open, setOpen] = useState(false);

  const queryClient = useQueryClient()

  const createColumnMutation = useMutation({
    mutationFn: (type: BoardColumnType) => createColumn(boardId || 0, type),

    onSuccess: () => {
      toast.success("Column created");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      console.log(
        "GROUP TASKS:",
        group.tasks.map((task: any) => ({
          id: task.id,
          name: task.name,
          parentTaskId: task.parentTaskId,
          parentId: task.parentId,
        })),
      );

      setOpen(false);
    },

    onError: () => {
      toast.error("Failed to create column");
    },
  });

  // Tasks are already loaded and assigned to this group
  // by Board.tsx.
  const hydratedGroup = group;

  return (
    <>
    <div className="overflow-hidden">
      <GroupHeader
        group={group}
        // focusToken={focusToken}
      />
      <GroupTable
        group={hydratedGroup}
        columns={columns}
        selection={selection}
        showSelection={false}
        showNewTaskRow
        showAddColumn={false}
        setOpen={setOpen}
        newTaskFocusToken={newTaskFocusToken}
        members={members}
      />
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

