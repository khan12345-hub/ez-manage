"use client";

import { useState } from "react";

import { useInviteModalStore } from "@/store/invite-modal";
import { useGroupStore } from "@/store/create-group-store";

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
  const addNewGroup = useGroupStore((s) => s.addNewGroup);

  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const queryClient = useQueryClient();

  const createColumnMutation = useMutation({
    mutationFn: (type: BoardColumnType) => createColumn(boardId || 0, type),

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

  const hydratedGroup = group;
  const rootTasks = (group.tasks ?? []).filter((t: any) => !t.parentId);
  const rootTaskCount = rootTasks.length;

  // Find a STATUS or CHECKBOX column to measure completion
  const colList: any[] = Array.isArray(columns) ? columns : [];
  const checkboxCol = colList.find((c: any) => c.type === "CHECKBOX");
  const statusCol = colList.find((c: any) => c.type === "STATUS");

  const completedTaskCount = rootTasks.filter((task: any) => {
    if (checkboxCol) {
      const cell = task.cells?.find((c: any) => c.columnId === checkboxCol.id);
      const val = cell?.value;
      if (val === true) return true;
      if (val && typeof val === "object") {
        if (val.checked === true) return true;
        if (val.checked?.checked === true) return true;
      }
    }
    if (statusCol) {
      const cell = task.cells?.find((c: any) => c.columnId === statusCol.id);
      const label: string = cell?.value?.label ?? "";
      if (/done|complet|finish/i.test(label)) return true;
    }
    return false;
  }).length;

  const showProgress = (checkboxCol || statusCol) && rootTaskCount > 0;

  return (
    <>
      <div>
        <GroupHeader
          group={group}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((v) => !v)}
          onAddGroup={addNewGroup}
          taskCount={rootTaskCount}
          completedTaskCount={showProgress ? completedTaskCount : undefined}
        />

        {!isCollapsed && (
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
