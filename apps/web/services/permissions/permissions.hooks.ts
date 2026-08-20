import { useAuth } from "@/providers/AuthProvider";
export function usePermissions() {
  const { user } = useAuth();

  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";

  return {
    isSuperAdmin,

    can: (allowed: boolean) => {
      return isSuperAdmin || allowed;
    },

    canManageBoard: (isOwner: boolean) =>
      isSuperAdmin || isOwner,

    canManageMembers: (isOwner: boolean) =>
      isSuperAdmin || isOwner,

    canManageColumn: (hasPermission: boolean) =>
      isSuperAdmin || hasPermission,

    canDelete: (allowed: boolean) =>
      isSuperAdmin || allowed,
  };
}