"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  groupId: number;
  children:
    | React.ReactNode
    | ((props: {
        attributes: any;
        listeners: any;
      }) => React.ReactNode);
}

export function SortableGroupContainer({
  groupId,
  children,
}: Props) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `group-${groupId}`,
    data: {
      type: "group",
      groupId,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === "function"
        ? children({
            attributes,
            listeners,
          })
        : children}
    </div>
  );
}