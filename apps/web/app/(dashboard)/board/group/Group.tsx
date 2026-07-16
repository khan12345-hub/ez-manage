import { Plus } from "lucide-react";
import { Headers } from "./columns/Headers";
import { TaskRow } from "./tasks/TaskRow";
import { useEffect, useState } from "react";
import { ColumnTypeModal } from "./columns/AddColumnModal";
import { GroupHeader } from "./GroupHeader";
import { useInviteModalStore } from "@/store/invite-modal";
import { GroupActions } from "./GroupActions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BoardColumnType, createColumn } from "@/services/columns.api";
import { toast } from "sonner";
import { NewTaskRow } from "./tasks/AddNewTaskRow";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  // group: Group;
  // columns: Column[];
  group: any;
  columns: any;
}
export function Group({ group, columns }: Props) {
  const [open, setOpen] = useState(false);
  console.log("tasks", group.tasks);
  const [color, setColor] = useState(group.color);
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

  return (
    <>
      <div className="overflow-hidden">
        {group.isNew || group.isEditing ? (
          <GroupHeader group={group} />
        ) : (
          <div className="group flex items-center justify-start py-3">
            <GroupActions group={group} />
            <span style={{ color: group.color }} className="font-semibold">
              {group.name}
            </span>
          </div>
        )}
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

                {columns.map((column: any) => (
                  <Headers key={column.id} column={column} />
                ))}

                <th
                  onClick={() => setOpen(true)}
                  className="flex w-44 cursor-pointer items-center gap-2 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add Column
                </th>
              </tr>
            </thead>

            <tbody>

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
            </tbody>
          </table>
        </div>
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
