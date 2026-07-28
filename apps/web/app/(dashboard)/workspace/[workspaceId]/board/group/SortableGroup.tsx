"use client";

import { useDroppable } from "@dnd-kit/core";

export function SortableGroup({
  id,
  groupId,
  children,
}: {
  id: string;
  groupId: number;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id,
    data: {
      type: "group",
      groupId,
    },
  });

  return (
    <div ref={setNodeRef}>
      {children}
    </div>
  );
}