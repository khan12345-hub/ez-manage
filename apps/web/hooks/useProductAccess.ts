"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllWorkspaces } from "@/services/workspace.api";
import { workApi } from "@/services/work.api";
import { useAuth } from "@/providers/AuthProvider";
import { useCeoAccess } from "@/services/ceo-tower.api";

/**
 * Which products this person can open. Each product has its own access:
 *  - Boards  = a Boards workspace membership (Boards invite)
 *  - Work    = a Work membership (Work invite)
 *  - CEO     = owns a company, or an owner shared CEO Tower with them
 * Only those products are shown anywhere in the app.
 */
export function useProductAccess() {
  const { user } = useAuth();
  const boards = useQuery({ queryKey: ["workspaces"], queryFn: getAllWorkspaces, enabled: !!user, staleTime: 30_000 });
  const work = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, enabled: !!user, staleTime: 30_000 });
  const ceo = useCeoAccess();
  const boardsWorkspaces = ((boards.data as any[] | undefined) ?? []);
  const workWorkspaces = work.data ?? [];
  const firstBoards = boardsWorkspaces[0];
  const firstWork = workWorkspaces[0];
  const hasBoards = boardsWorkspaces.length > 0;
  const hasWork = workWorkspaces.length > 0;
  const boardsHref = firstBoards ? `/workspace/${firstBoards.uid ?? firstBoards.id}` : undefined;
  const workHref = firstWork ? `/work/${firstWork.uid}` : undefined;
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";
  const loading = !user || boards.isLoading || work.isLoading || ceo.loading;
  const hrefs = [hasBoards && boardsHref, hasWork && workHref, ceo.allowed && "/ceo"].filter(Boolean) as string[];
  return {
    loading,
    hasBoards,
    hasWork,
    hasCeo: ceo.allowed,
    boardsWorkspaces,
    workWorkspaces,
    boardsHref,
    workHref,
    /** how many products this person can open */
    productCount: hrefs.length,
    /** the one product to open when there is exactly one */
    onlyHref: hrefs.length === 1 ? hrefs[0] : undefined,
    /** starting a new Work workspace: people already in Work (not guests / limited), or the super admin */
    canCreateWork: isSuperAdmin || workWorkspaces.some((w: any) => ["OWNER", "ADMIN", "MEMBER"].includes(w.role)),
    /** fetch fresh before sending someone away (a just-accepted invite may not be cached yet) */
    refetch: () => Promise.all([boards.refetch(), work.refetch()]),
  };
}
