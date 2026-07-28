"use client";

import { useEffect, useState } from "react";

import { useInviteModalStore } from "@/store/invite-modal";
import { useGroupStore } from "@/store/create-group-store";
import { useBoardFilters } from "./filters/useBoardFilters";
import { useBoardDnd } from "./BoardDND/useBoardDnd";

interface UseBoardProps {
  board: any;
}

export function useBoard({ board }: UseBoardProps) {
  const groups = useGroupStore((state) => state.groups);

  const setGroups = useGroupStore((state) => state.setGroups);

  const { boardId } = useInviteModalStore();

  const [columns, setColumns] = useState<any[]>(board.columns || []);

  useEffect(() => {
    if (!board.columns) {
      return;
    }

    setColumns(board.columns);
  }, [board.columns]);

  const filters = useBoardFilters({
    columns,
  });

  const {
    dragGroups,
    dragColumns,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useBoardDnd({
    groups,
    setGroups,
    columns,
    setColumns,
    boardId: board.id || boardId || 0,
  });

  return {
    groups,
    dragGroups,
    dragColumns,
    columns,
    filteredColumns: filters.filteredColumns,
    activeItem,
    filters,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
