"use client";

import { useInviteModalStore } from "@/store/invite-modal";
import { usePermissions } from "@/services/permissions/permissions.hooks";

/**
 * Who may create / rename / recolor / duplicate / reorder / archive / delete
 * groups. Mirrors the API (CREATE_GROUP / UPDATE_GROUP / DELETE_GROUP):
 * super admin, workspace OWNER/ADMIN, or board OWNER/ADMIN.
 * Regular members and viewers can still work on tasks inside groups.
 */
export function useCanManageGroups(): boolean {
  const { boardRole, workspaceRole } = useInviteModalStore();
  const { isSuperAdmin } = usePermissions();

  return (
    !!isSuperAdmin ||
    boardRole === "OWNER" ||
    boardRole === "ADMIN" ||
    workspaceRole === "OWNER" ||
    workspaceRole === "ADMIN"
  );
}
