import { BoardPermission, WorkspacePermission } from "@repo/shared";
import { WorkspaceMemberRole } from "generated/prisma/enums";

export const WORKSPACE_ROLE_PERMISSIONS: Record<
  WorkspaceMemberRole,
  BoardPermission[]
> = {
  // Full control — owns the workspace
  [WorkspaceMemberRole.OWNER]: Object.values(BoardPermission),

  // Manages workspace: all board operations except deleting the workspace itself
  [WorkspaceMemberRole.ADMIN]: [
    BoardPermission.VIEW,
    BoardPermission.EDIT,
    BoardPermission.DELETE,

    BoardPermission.CREATE_TASK,
    BoardPermission.UPDATE_TASK,
    BoardPermission.DELETE_TASK,

    BoardPermission.CREATE_GROUP,
    BoardPermission.UPDATE_GROUP,
    BoardPermission.DELETE_GROUP,

    BoardPermission.CREATE_COLUMN,
    BoardPermission.UPDATE_COLUMN,
    BoardPermission.DELETE_COLUMN,

    BoardPermission.MANAGE_MEMBERS,
    BoardPermission.MANAGE_SETTINGS,
    BoardPermission.IMPORT_BOARD,
    BoardPermission.EXPORT_BOARD,
  ],

  // Regular team member: can work on tasks and collaborate
  [WorkspaceMemberRole.MEMBER]: [
    BoardPermission.VIEW,
    BoardPermission.EDIT,

    BoardPermission.CREATE_TASK,
    BoardPermission.UPDATE_TASK,
    BoardPermission.DELETE_TASK,
  ],

  // Read-only across all boards in the workspace
  [WorkspaceMemberRole.VIEWER]: [
    BoardPermission.VIEW,
  ],

  // External/client access — read-only, no exports
  [WorkspaceMemberRole.GUEST]: [
    BoardPermission.VIEW,
  ],
};

/**
 * Workspace-level permissions (WorkspacePermission), used by
 * WorkspaceAccessService / WorkspacePermissionGuard.
 *
 * The table above lists BOARD permissions and was previously used for these
 * checks too, so workspace actions never matched: owners got 403 on rename /
 * member-role / remove-member, while ADMIN matched "DELETE" and could delete
 * the whole workspace.
 */
export const WORKSPACE_ROLE_WORKSPACE_PERMISSIONS: Record<
  WorkspaceMemberRole,
  WorkspacePermission[]
> = {
  [WorkspaceMemberRole.OWNER]: Object.values(WorkspacePermission),
  // everything except deleting the workspace
  [WorkspaceMemberRole.ADMIN]: Object.values(WorkspacePermission).filter(
    (p) => p !== WorkspacePermission.DELETE,
  ),
  [WorkspaceMemberRole.MEMBER]: [WorkspacePermission.VIEW, WorkspacePermission.VIEW_ACTIVITY],
  [WorkspaceMemberRole.VIEWER]: [WorkspacePermission.VIEW],
  [WorkspaceMemberRole.GUEST]: [WorkspacePermission.VIEW],
};
