import {
  BoardPermission,
} from "@repo/shared";
import { BoardMemberRole, WorkspaceMemberRole } from "generated/prisma/enums";
console.log({
  BoardMemberRole,
  WorkspaceMemberRole,
  BoardPermission,
});
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
  ],

  [BoardMemberRole.MEMBER]: [
    BoardPermission.VIEW,
    BoardPermission.EDIT,
    BoardPermission.CREATE_TASK,
    BoardPermission.UPDATE_TASK,
    BoardPermission.DELETE_TASK
  ],

  [BoardMemberRole.VIEWER]: [
    BoardPermission.VIEW,
  ],
};

export const WORKSPACE_ROLE_PERMISSIONS: Record<
  WorkspaceMemberRole,
  BoardPermission[]
> = {
  [WorkspaceMemberRole.OWNER]: Object.values(BoardPermission),

  [WorkspaceMemberRole.ADMIN]: Object.values(BoardPermission),

  [WorkspaceMemberRole.MEMBER]: [
    BoardPermission.VIEW,
  ],
};