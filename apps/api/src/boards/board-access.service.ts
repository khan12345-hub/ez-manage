import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

import { BoardPermission } from '@repo/shared';

import {
  BoardMemberRole,
  SystemRole,
  WorkspaceMemberRole,
} from 'generated/prisma/enums';

import { BOARD_ROLE_PERMISSIONS } from '../auth/permissions/board-permissions';
import { WORKSPACE_ROLE_PERMISSIONS } from '../auth/permissions/workspace-permissions';

@Injectable()
export class BoardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creating a board (or importing one) inside a workspace requires being an
   * active OWNER / ADMIN / MEMBER of that workspace, or a super admin.
   * Previously any logged-in user could create boards in any workspace.
   */
  async assertCanCreateBoard(workspaceId: number, userId: number): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { systemRole: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    if (user.systemRole === SystemRole.SUPER_ADMIN) return;

    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deletedAt: null },
      select: { role: true },
    });
    const allowed: WorkspaceMemberRole[] = [
      WorkspaceMemberRole.OWNER,
      WorkspaceMemberRole.ADMIN,
      WorkspaceMemberRole.MEMBER,
    ];
    if (!member || !allowed.includes(member.role as WorkspaceMemberRole)) {
      throw new ForbiddenException(
        "You don't have permission to create boards in this workspace.",
      );
    }
  }

  /**
   * Permission check for endpoints addressed by task id only (no board in the
   * URL), e.g. comments. Resolves the task's board, applies the normal board
   * permission AND the member's group restriction.
   */
  async requireTaskPermission(
    taskId: number,
    userId: number,
    permission: BoardPermission,
  ): Promise<{ boardId: number }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { groupId: true, group: { select: { boardId: true } } },
    });
    if (!task) throw new NotFoundException('Task not found.');

    const boardId = task.group.boardId;
    await this.requirePermission(boardId, userId, permission);

    const allowed = await this.getAllowedGroupIds(boardId, userId);
    if (allowed && !allowed.includes(task.groupId)) {
      throw new NotFoundException('Task not found.');
    }
    return { boardId };
  }

  /** Same as requireTaskPermission, addressed by comment id; optionally asserts the comment belongs to taskId. */
  async requireCommentPermission(
    commentId: number,
    userId: number,
    permission: BoardPermission,
    taskId?: number,
  ): Promise<void> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      select: { taskId: true },
    });
    if (!comment || (taskId !== undefined && comment.taskId !== taskId)) {
      throw new NotFoundException('Comment not found.');
    }
    await this.requireTaskPermission(comment.taskId, userId, permission);
  }

  /**
   * Groups of a board this user may see.
   * Returns null when the user is not group-restricted (sees every group).
   */
  async getAllowedGroupIds(
    boardId: number,
    userId: number,
  ): Promise<number[] | null> {
    const member = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: {
        accessAllGroups: true,
        groupAccess: { select: { groupId: true } },
      },
    });
    if (!member || member.accessAllGroups) return null;
    return member.groupAccess.map((g) => g.groupId);
  }

  async requirePermission(
    boardId: number,
    userId: number,
    permission: BoardPermission,
  ): Promise<boolean> {
    // ---------------------------------------
    // Check System Role first
    // ---------------------------------------
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        systemRole: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      return true;
    }

    // ---------------------------------------
    // Load Board Access
    // ---------------------------------------
    console.log({
      boardId,
      userId,
      permission
    });

    const board = await this.prisma.board.findUnique({
      where: {
        id: boardId,
      },
      select: {
        visibility: true,
        workspace: {
          select: {
            members: {
              where: {
                userId,
                deletedAt: null, // removed (soft-deleted) members get no access
              },
              select: {
                role: true,
              },
              take: 1,
            },
          },
        },
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
          take: 1,
        },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found.');
    }

    const workspaceRole = board.workspace.members[0]?.role as
      | WorkspaceMemberRole
      | undefined;

    const boardRole = board.members[0]?.role as BoardMemberRole | undefined;

    // PRIVATE board: only explicit board members have access
    if (board.visibility === 'PRIVATE') {
      if (boardRole && BOARD_ROLE_PERMISSIONS[boardRole]?.includes(permission)) {
        return true;
      }
      throw new ForbiddenException(
        "You don't have permission to perform this action.",
      );
    }

    // PUBLIC board:
    //  - workspace OWNER/ADMIN always get their workspace permissions;
    //  - otherwise an explicit board role decides on its own (so a board
    //    VIEWER stays read-only even if they are a workspace MEMBER);
    //  - with no board role, the workspace role applies.
    const isWorkspaceAdmin =
      workspaceRole === WorkspaceMemberRole.OWNER ||
      workspaceRole === WorkspaceMemberRole.ADMIN;

    if (isWorkspaceAdmin || !boardRole) {
      if (
        workspaceRole &&
        WORKSPACE_ROLE_PERMISSIONS[workspaceRole]?.includes(permission)
      ) {
        return true;
      }
    }

    if (boardRole && BOARD_ROLE_PERMISSIONS[boardRole]?.includes(permission)) {
      return true;
    }

    throw new ForbiddenException(
      "You don't have permission to perform this action.",
    );
  }
}
