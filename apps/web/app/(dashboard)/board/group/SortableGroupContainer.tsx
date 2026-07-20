"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  groupId: number;
  children: React.ReactNode | ((props: { attributes: any; listeners: any }) => React.ReactNode);
}

export function SortableGroupContainer({
  groupId,
  children,
}: Props) {
  const {
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
    isDragging,
  } = useSortable({
    id: `group-${groupId}`,
    data: {
      type: "group",
      groupId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {typeof children === "function" ? (
        children({ attributes, listeners })
      ) : (
        <div {...attributes} {...listeners}>
          {children}
        </div>
      )}
    </div>
  );
}