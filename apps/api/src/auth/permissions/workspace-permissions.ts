import { BoardPermission } from "@repo/shared";
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

    BoardPermission.CREATE_GROUP,
    BoardPermission.UPDATE_GROUP,

    BoardPermission.EXPORT_BOARD,
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
