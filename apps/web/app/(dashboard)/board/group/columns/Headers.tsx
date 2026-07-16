import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EditableCell } from "../../EditableCells/EditableCell";
import { TextEditor } from "../../EditableCells/TextEditor";
import { useInviteModalStore } from "@/store/invite-modal";
import { updateColumn } from "@/services/columns.api";
import { ColumnActions } from "./ColumnActions";

export const Headers = ({ column }: any) => {
  const queryClient = useQueryClient();
  const { boardId } = useInviteModalStore();

  const updateColumnMutation = useMutation({
    mutationFn: async (name: string) => updateColumn(column.id, name),
    onSuccess: () => {
      toast.success("Column updated");

      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });
    },
    onError: () => {
      toast.error("Failed to update column");
    },
  });

  return (
    <>
      <th
        className={`
        border-b border-l px-4 py-3 font-semibold
      ${
        column.isPrimary
          ? "sticky left-0 z-30 bg-background min-w-[300px]"
          : "min-w-[180px]"
      }

    `}
      >
        <div className="flex group justify-between">
          <EditableCell
            value={column.name}
            render={(value) => (
              <span className="cursor-text">{value}</span>
            )}
            editor={TextEditor}
            onSave={(value) => {
              const name = value.trim();

              // Don't send unnecessary requests
              if (!name || name === column.name) return;

              updateColumnMutation.mutate(name);
            }}
          />
          <ColumnActions column={column} />
        </div>
      </th>
    </>
  );
};
