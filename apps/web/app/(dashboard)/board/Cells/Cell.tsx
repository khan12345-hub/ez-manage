import { EditableCell } from "../EditableCells/EditableCell";
import { CELL_CONFIG } from "./cell-config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTask, UpdateTaskDto } from "@/services/tasks.api";
import { useInviteModalStore } from "@/store/invite-modal";
import { cn } from "@/lib/utils";
import { updateCell, UpdateCellDto } from "@/services/cells.api";

interface CellProps {
  column: any;
  task: any;
}

export function Cell({ column, task }: CellProps) {
  const { boardId } = useInviteModalStore();

  const queryClient = useQueryClient();
  const isPrimary = column.isPrimary;
  const cell = isPrimary
    ? null
    : task.cells.find((c: any) => c.columnId === column.id);
  // const cell = task.cells.find(
  //   (item: any) => item.columnId === column.id
  // );
  console.log({
    column: column.name,
    type: column.type,
    cellColumn: cell?.column?.name,
    value: cell?.value,
  });
  const config = CELL_CONFIG[column.type as keyof typeof CELL_CONFIG];

  const mutation = useMutation({
    mutationFn: ({ id, value }: { id: number; value: any }) =>
      updateCell(id, value),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
  });

  if (!config) {
    return <td className="border px-3 py-2">—</td>;
  }

  const Editor = config.editor;
  const value = config.getValue(task, cell, column);

  const taskMutation = useMutation({
    mutationFn: ({ taskId, dto }: { taskId: number; dto: UpdateTaskDto }) =>
      updateTask(taskId, dto),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
  });

  const cellMutation = useMutation({
    mutationFn: ({ cellId, dto }: { cellId: number; dto: UpdateCellDto }) =>
      updateCell(cellId, dto),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
  });
  return (
    <td
      className={cn(
        "border px-3 py-2",
        column.isPrimary && "sticky left-0 bg-background z-10",
      )}
    >
      <EditableCell
        value={value}
        render={config.render}
        editor={Editor}
        onSave={(value) => {
          if (column.isPrimary) {
            console.log("value", value)
            taskMutation.mutate({
              taskId: task.id,
              dto: {
                name: value,
              },
            });

            return;
          }

          cellMutation.mutate({
            cellId: cell.id,
            dto: {
              value,
            },
          });
        }}
      />
    </td>
  );
}
