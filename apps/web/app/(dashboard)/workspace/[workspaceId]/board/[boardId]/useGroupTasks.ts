"use client";

import { useQuery } from "@tanstack/react-query";
import { getGroupTasks } from "@/services/tasks.api";

interface Props {
  boardId: number;
  groupId: number;
  search?: string;
  person?: string;
  enabled?: boolean;
}

export function useGroupTasks({
  boardId,
  groupId,
  search,
  person,
  enabled = true,
}: Props) {
  return useQuery({
    queryKey: [
      "group-tasks",
      boardId,
      groupId,
      search ?? "",
      person ?? "",
    ],

    queryFn: () =>
      getGroupTasks(
        boardId,
        groupId,
        search,
        person,
      ),

    enabled: enabled && !!boardId && !!groupId,

    staleTime: 30_000,

    placeholderData: (previousData) => previousData,
  });
}