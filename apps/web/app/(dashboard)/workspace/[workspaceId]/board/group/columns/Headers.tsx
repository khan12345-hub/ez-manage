"use client";

import { useEffect, useRef, useState } from "react";
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

  const DEFAULT_WIDTH = column.isPrimary ? 300 : 180;
  const MIN_WIDTH = column.isPrimary ? 250 : 120;

  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

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
    width,
    minWidth: width,
    maxWidth: width,
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    resizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;

      const diff = e.clientX - startX.current;

      const newWidth = Math.max(
        MIN_WIDTH,
        startWidth.current + diff
      );

      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!resizing.current) return;

      resizing.current = false;

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [MIN_WIDTH]);

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`
        group
        relative
        border-b border-l
        px-4 py-3
        font-semibold
        ${
          column.isPrimary
            ? "sticky left-[150px] z-30 bg-background"
            : ""
        }
      `}
    >
      <div className="flex h-full items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {!column.isPrimary && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="
                cursor-grab
                rounded
                p-1
                text-muted-foreground
                opacity-0
                transition-opacity
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
              min-w-0
              flex-1
              border-transparent
              bg-transparent
              px-2
              font-semibold
              shadow-none
              focus-visible:ring-1
            "
          />
        </div>

        <ColumnActions
          members={members}
          column={column}
        />
      </div>

      {/* Excel-style resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="
          absolute
          right-[-3px]
          top-0
          z-50
          h-full
          w-[6px]
          cursor-col-resize
        "
      >
        <div
          className="
            mx-auto
            h-full
            w-[2px]
            opacity-0
            transition-opacity
            group-hover:opacity-100
            hover:bg-primary
          "
        />
      </div>
    </th>
  );
};