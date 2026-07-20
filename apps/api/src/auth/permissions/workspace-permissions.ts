import {
  BoardPermission,
} from "@repo/shared";

import {
  WorkspaceMemberRole,
} from "generated/prisma/enums";

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

    BoardPermission.MANAGE_AUTOMATIONS,
  ],

  [WorkspaceMemberRole.MEMBER]: [
    BoardPermission.VIEW,
  ],
};