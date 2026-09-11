import { BoardPermission } from "@repo/shared";
import { BoardMemberRole, WorkspaceMemberRole } from "generated/prisma/enums";

// Board-level role permissions (board-specific membership overrides)
export const BOARD_ROLE_PERMISSIONS: Record<
  BoardMemberRole,
  BoardPermission[]
> = {
  [BoardMemberRole.OWNER]: Object.values(BoardPermission),

  [BoardMemberRole.ADMIN]: [
    BoardPermission.VIEW,
    BoardPermission.EDIT,

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

  // Can work on tasks but not restructure the board
  [BoardMemberRole.MEMBER]: [
    BoardPermission.VIEW,
    BoardPermission.EDIT,

    BoardPermission.CREATE_TASK,
    BoardPermission.UPDATE_TASK,
    BoardPermission.DELETE_TASK,
  ],

  // Read-only on this specific board
  [BoardMemberRole.VIEWER]: [
    BoardPermission.VIEW,
  ],
};

// Workspace-level role permissions used when no board-specific role is set
export const WORKSPACE_ROLE_PERMISSIONS: Record<
  WorkspaceMemberRole,
  BoardPermission[]
> = {
  [WorkspaceMemberRole.OWNER]: Object.values(BoardPermission),

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

  [WorkspaceMemberRole.MEMBER]: [
    BoardPermission.VIEW,
    BoardPermission.EDIT,

    BoardPermission.CREATE_TASK,
    BoardPermission.UPDATE_TASK,
    BoardPermission.DELETE_TASK,

    BoardPermission.CREATE_GROUP,
    BoardPermission.UPDATE_GROUP,
  ],

  [WorkspaceMemberRole.VIEWER]: [
    BoardPermission.VIEW,
  ],

  [WorkspaceMemberRole.GUEST]: [
    BoardPermission.VIEW,
  ],
};
