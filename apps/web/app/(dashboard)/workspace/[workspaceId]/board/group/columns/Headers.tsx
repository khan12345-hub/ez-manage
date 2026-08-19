"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ColumnActions } from "./ColumnActions";

import { useColumnRename } from "./useColumnRename.hooks";

export const Headers = ({ column, members }: any) => {
  const { name, setName, save, handleKeyDown, isSaving } =
    useColumnRename({
      columnId: column.id,
      columnName: column.name,
    });

  

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

  const style = {
    transform: transform
      ? CSS.Transform.toString(transform)
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`
        group
        border-b border-l px-4 py-3 font-semibold
        ${
          column.isPrimary
            ? "sticky left-[150px] z-30 min-w-[300px] bg-background"
            : "min-w-[180px]"
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {!column.isPrimary && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="
                cursor-grab rounded p-1
                text-muted-foreground
                opacity-0 transition-opacity
                hover:bg-muted
                group-hover:opacity-100
              "
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="
              h-8
              border-transparent
              bg-transparent
              px-2
              font-semibold
              shadow-none
              focus-visible:ring-1
            "
          />
        </div>

        <ColumnActions members={members}  column={column} />
      </div>
    </th>
  );
};