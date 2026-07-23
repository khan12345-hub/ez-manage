import { Plus, GripVertical } from "lucide-react";
import { Headers } from "./columns/Headers";
import { useState } from "react";
import { ColumnTypeModal } from "./columns/AddColumnModal";
import { GroupHeader } from "./GroupHeader";
import { useInviteModalStore } from "@/store/invite-modal";
import { GroupActions } from "./GroupActions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BoardColumnType, createColumn } from "@/services/columns.api";
import { toast } from "sonner";
import { NewTaskRow } from "./tasks/AddNewTaskRow";
import { Checkbox } from "@/components/ui/checkbox";
import { DragEndEvent, useDroppable } from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { SortableTaskRow } from "./tasks/SortableTaskRow";

interface Props {
  // group: Group;
  // columns: Column[];
  group: any;
  columns: any;
  dragHandleProps?: any;
  isDraggingGroup?: boolean;
}
export function Group({ group, columns, dragHandleProps, isDraggingGroup }: Props) {
  const [open, setOpen] = useState(false);
  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  const createColumnMutation = useMutation({
    mutationFn: (type: BoardColumnType) => createColumn(boardId || 0, type),
    onSuccess: () => {
      toast.success("Column created");

      // Refetch the board so the new column and cells appear
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      setOpen(false);
    },
    onError: () => {
      toast.error("Failed to create column");
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    console.log(event);
  }

  const { setNodeRef } = useDroppable({
    id: `group-drop-${group.id}`,
    data: {
      type: "group-drop",
      groupId: group.id,
    },
  });

  return (
    <>
      <div className="overflow-hidden">
        {group.isNew || group.isEditing ? (
          <GroupHeader group={group} />
        ) : (
          <div className="group flex items-center justify-start py-3 gap-2">
            <button
              type="button"
              {...dragHandleProps}
              className="cursor-grab rounded p-1 hover:bg-muted active:cursor-grabbing text-muted-foreground"
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
          <div className="overflow-x-auto scrollbar-none">
            <table className="min-w-[1200px] border-collapse">
              <thead>
                <tr className="border">
                  <th
                    className="w-1.5 sticky left-0"
                    style={{ backgroundColor: group.color }}
                  />

                  <th>
                    <Checkbox />
                  </th>

                  <SortableContext
                    items={columns.map((col: any) => `column-${col.id}`)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {columns.map((column: any) => (
                      <Headers key={column.id} column={column} />
                    ))}
                  </SortableContext>

                  <th
                    onClick={() => setOpen(true)}
                    className="flex w-44 cursor-pointer items-center gap-2 px-4 py-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add Column
                  </th>
                </tr>
              </thead>

              {/* <tbody>
                {group.tasks?.length > 0 &&
                  group.tasks.map((task: any) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      columns={columns}
                      color={group.color}
                    />
                  ))}
                <NewTaskRow
                  columns={columns}
                  color={group.color}
                  groupId={group.id}
                />
              </tbody> */}

              <SortableContext
                items={group.tasks.map((task:any) => `task-${task.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <tbody ref={setNodeRef}>
                  {group.tasks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + 3}
                        className="h-16 border-2 border-dashed text-center text-muted-foreground"
                      >
                        Drop task here
                      </td>
                    </tr>
                  ) : (
                    group.tasks.map((task: any) => (
                      <SortableTaskRow
                        key={task.id}
                        task={task}
                        columns={columns}
                        color={group.color}
                      />
                    ))
                  )}

                  <NewTaskRow
                    columns={columns}
                    color={group.color}
                    groupId={group.id}
                  />
                </tbody>
              </SortableContext>
            </table>
          </div>
        )}
      </div>

      <ColumnTypeModal
        open={open}
        onOpenChange={setOpen}
        onSelect={(type) => {
          console.log(type);
          createColumnMutation.mutate(type);
          // Create column API
        }}
      />
    </>
  );
}
