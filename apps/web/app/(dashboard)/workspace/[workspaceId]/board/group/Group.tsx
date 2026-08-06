import { Plus, GripVertical } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";

import { Headers } from "./columns/Headers";
import { ColumnTypeModal } from "./columns/AddColumnModal";
import { GroupHeader } from "./GroupHeader";
import { GroupActions } from "./GroupActions";

import { useInviteModalStore } from "@/store/invite-modal";

import { BoardColumnType, createColumn } from "@/services/columns.api";

import { NewTaskRow } from "./tasks/AddNewTaskRow";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskHierarchyRow } from "./tasks/TaskRowHierarchy";
import { GroupTable } from "./GroupTable";

interface Props {
  group: any;
  columns: any[];
  dragHandleProps?: any;
  isDraggingGroup?: boolean;
  isDraggingTask?: boolean;
  selection: any;
}

export function Group({
  group,
  columns,
  dragHandleProps,
  isDraggingGroup,
  isDraggingTask,
  selection,
}: Props) {
  const [open, setOpen] = useState(false);

  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

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

  const { setNodeRef } = useDroppable({
    id: `group-drop-${group.id}`,

    data: {
      type: "group-drop",
      groupId: group.id,
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    console.log(event);
  }

  /**
   * Only render top-level tasks here.
   *
   * Subtasks should be rendered inside TaskHierarchyRow
   * underneath their respective parent task.
   *
   * This prevents subtasks from appearing as independent
   * top-level rows in the group.
   */
  const rootTasks = (group.tasks ?? []).filter(
    (task: any) => !task.parentTaskId,
  );

  const groupSelection = selection.getGroupSelectionState(group);
  return (
    <>
      <div className="overflow-hidden">
        {group.isNew || group.isEditing ? (
          <GroupHeader group={group} />
        ) : (
          <div className="group flex items-center justify-start gap-2 py-3">
            <button
              type="button"
              {...dragHandleProps}
              className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <GroupActions group={group} />

            <span style={{ color: group.color }} className="font-semibold">
              {group.name}
            </span>
          </div>
        )}

        {!isDraggingGroup && (
          
            <GroupTable
              group={group}
              columns={columns}
              selection={selection}
              showSelection={false}
              showNewTaskRow={false}
              showAddColumn={false}
              setOpen={setOpen}
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
