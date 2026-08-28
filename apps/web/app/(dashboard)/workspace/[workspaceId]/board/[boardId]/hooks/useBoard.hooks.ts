"use client";

import { useInviteModalStore } from "@/store/invite-modal";
import { useGroupStore } from "@/store/create-group-store";

import { useBoardFilters } from "./filters/useBoardFilters";
import { useBoardDnd } from "./BoardDND/useBoardDnd";

interface UseBoardProps {
  board: any;
}

export function useBoard({ board }: UseBoardProps) {
  const storeGroups = useGroupStore((state) => state.groups);

  const setGroups = useGroupStore((state) => state.setGroups);

  const { boardId } = useInviteModalStore();

  const columns = board?.columns ?? [];

  /**
   * Use the groups passed from Board when available.
   *
   * Board.tsx attaches the currently loaded/paginated tasks
   * to these groups before calling useBoard().
   *
   * Fall back to the Zustand groups for draft/new-group states.
   */
  const groups =
    board?.groups?.length > 0
      ? board.groups
      : storeGroups;

  const filters = useBoardFilters({
    columns,
    boardId: board?.id ?? boardId ?? 0,
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
    setColumns: () => {},
    boardId: board?.id ?? boardId ?? 0,
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

