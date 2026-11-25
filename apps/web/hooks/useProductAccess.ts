"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllWorkspaces } from "@/services/workspace.api";
import { workApi } from "@/services/work.api";
import { useAuth } from "@/providers/AuthProvider";
import { useCeoAccess } from "@/services/ceo-tower.api";
import { trackerApi } from "@/services/tracker.api";
import { accessApi } from "@/services/access.api";
import { crmApi } from "@/services/crm.api";

/**
 * Which products this person can open. Each product has its own access:
 *  - Boards  = a Boards workspace membership (Boards invite)
 *  - Work    = a Work membership (Work invite)
 *  - CEO     = owns a company, or an owner shared CEO Tower with them
 * Only those products are shown anywhere in the app.
 */
export function useProductAccess() {
  const { user } = useAuth();
  // the Administrator's product switch (Access Center): a product turned off is hidden everywhere
  const mine = useQuery({ queryKey: ["access", "me"], queryFn: accessApi.me, enabled: !!user, staleTime: 60_000 });
  const off = new Set(mine.data?.off ?? []);
  const boards = useQuery({ queryKey: ["workspaces"], queryFn: getAllWorkspaces, enabled: !!user && !!mine.data && !off.has("accounts"), staleTime: 30_000 });
  const work = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, enabled: !!user && !!mine.data && !off.has("work"), staleTime: 30_000 });
  const ceo = useCeoAccess();
  // EZ Tracker: any Company Work workspace you are a member of (not a guest)
  const tracker = useQuery({ queryKey: ["tracker", "workspaces"], queryFn: trackerApi.workspaces, enabled: !!user && !!mine.data && !off.has("tracker"), staleTime: 60_000 });
  const trackerWorkspaces = tracker.data ?? [];
  // EZ Sales: a CRM workspace you are a member of (or may create one)
  const crm = useQuery({ queryKey: ["crm", "workspaces"], queryFn: crmApi.workspaces, enabled: !!user && !!mine.data, staleTime: 60_000 });
  const crmWorkspaces = crm.data?.workspaces ?? [];
  const boardsWorkspaces = off.has("accounts") ? [] : ((boards.data as any[] | undefined) ?? []);
  const workWorkspaces = off.has("work") ? [] : work.data ?? [];
  const firstBoards = boardsWorkspaces[0];
  const firstWork = workWorkspaces[0];
  const hasBoards = boardsWorkspaces.length > 0;
  const hasWork = workWorkspaces.length > 0;
  const boardsHref = firstBoards ? `/workspace/${firstBoards.uid ?? firstBoards.id}` : undefined;
  const workHref = firstWork ? `/work/${firstWork.uid}` : undefined;
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";
  const loading = !user || mine.isLoading || boards.isLoading || work.isLoading || ceo.loading || tracker.isLoading || crm.isLoading;
  // Every product the Home launcher shows must count, so /home only auto-opens when there is exactly
  // ONE. Previously Vault, Tracker and Sales were ignored here, so e.g. a Vault+Work person counted
  // as one product and got redirected straight into Work, never seeing Home.
  const canCreateWorkNow = !off.has("work") && (isSuperAdmin || workWorkspaces.some((w: any) => ["OWNER", "ADMIN", "MEMBER"].includes(w.role)));
  const hrefs = [
    hasBoards && boardsHref,
    (hasWork || canCreateWorkNow) && (hasWork ? workHref : "/work/create"),
    ceo.allowed && "/ceo",
    (!off.has("tracker") && trackerWorkspaces.length > 0) && (trackerWorkspaces[0] ? `/tracker/${trackerWorkspaces[0].key}` : "/tracker"),
    (crmWorkspaces.length > 0 || !!crm.data?.canCreate) && (crmWorkspaces[0] ? `/crm/${crmWorkspaces[0].uid}` : "/crm"),
    !off.has("vault") && "/vault",
  ].filter(Boolean) as string[];
  return {
    loading,
    isSuperAdmin,
    hasBoards,
    hasWork,
    hasCeo: ceo.allowed,
    hasTracker: !off.has("tracker") && trackerWorkspaces.length > 0,
    hasCrm: crmWorkspaces.length > 0,
    canCreateCrm: !!crm.data?.canCreate,
    crmWorkspaces,
    crmHref: crmWorkspaces[0] ? `/crm/${crmWorkspaces[0].uid}` : "/crm",
    hasVault: !off.has("vault"),
    /** Access Center: global Administrators, per-product Administrators and Access Managers */
    canManageAccess: !!mine.data?.canManage,
    /** products this person is a per-product Administrator of (accounts | work | tracker | vault | crm) */
    productAdminOf: (mine.data?.productAdminOf ?? []) as string[],
    trackerHref: trackerWorkspaces[0] ? `/tracker/${trackerWorkspaces[0].key}` : "/tracker",
    boardsWorkspaces,
    workWorkspaces,
    boardsHref,
    workHref,
    /** how many products this person can open */
    productCount: hrefs.length,
    /** the one product to open when there is exactly one */
    onlyHref: hrefs.length === 1 ? hrefs[0] : undefined,
    /** starting a new Work workspace: people already in Work (not guests / limited), or the super admin */
    canCreateWork: !off.has("work") && (isSuperAdmin || workWorkspaces.some((w: any) => ["OWNER", "ADMIN", "MEMBER"].includes(w.role))),
    /** fetch fresh before sending someone away (a just-accepted invite may not be cached yet) */
    refetch: () => Promise.all([boards.refetch(), work.refetch()]),
  };
}
