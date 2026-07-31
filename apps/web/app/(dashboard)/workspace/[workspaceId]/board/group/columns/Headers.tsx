import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useInviteModalStore } from "@/store/invite-modal";
import { updateColumn } from "@/services/columns.api";
import { ColumnActions } from "./ColumnActions";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";

export const Headers = ({ column }: any) => {
  const queryClient = useQueryClient();
  const { boardId } = useInviteModalStore();

  const [name, setName] = useState(column.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: {
      type: "column",
      columnId: column.id,
    },
    disabled: column.isPrimary,
  });

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

      // Restore previous value if update fails
      setName(column.name);
    },
  });

  const handleSave = () => {
    const trimmedName = name.trim();

    // Restore empty input
    if (!trimmedName) {
      setName(column.name);
      return;
    }

    // Don't send unnecessary requests
    if (trimmedName === column.name) {
      return;
    }

    updateColumnMutation.mutate(trimmedName);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }

    if (e.key === "Escape") {
      setName(column.name);
      e.currentTarget.blur();
    }
  };

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`
        border-b border-l px-4 py-3 font-semibold
        ${
          column.isPrimary
            ? "sticky left-[150px] z-30 bg-background min-w-[450px]"
            : "min-w-[180px]"
        }
      `}
    >
      <div className="flex group justify-between items-center">
        <div className="flex items-center gap-1.5 min-w-0">
          {!column.isPrimary && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="h-3 w-3" />
            </button>
          )}

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={updateColumnMutation.isPending}
            className="h-8 border-transparent bg-transparent px-2 font-semibold shadow-none focus-visible:ring-1"
          />
        </div>

        <ColumnActions column={column} />
      </div>
    </th>
  );
};