"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllWorkspaces } from "@/services/workspace.api";
import { workApi } from "@/services/work.api";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Which products this person can open. Boards and Work have separate access:
 * Boards = Boards workspace membership, Work = Work membership.
 */
export function useProductAccess() {
  const { user } = useAuth();
  const boards = useQuery({ queryKey: ["workspaces"], queryFn: getAllWorkspaces, enabled: !!user, staleTime: 30_000 });
  const work = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, enabled: !!user, staleTime: 30_000 });
  const boardsWorkspaces = ((boards.data as any[] | undefined) ?? []);
  const workWorkspaces = work.data ?? [];
  const firstBoards = boardsWorkspaces[0];
  const firstWork = workWorkspaces[0];
  return {
    loading: boards.isLoading || work.isLoading,
    hasBoards: boardsWorkspaces.length > 0,
    hasWork: workWorkspaces.length > 0,
    boardsWorkspaces,
    workWorkspaces,
    boardsHref: firstBoards ? `/workspace/${firstBoards.uid ?? firstBoards.id}` : undefined,
    workHref: firstWork ? `/work/${firstWork.uid}` : undefined,
  };
}
