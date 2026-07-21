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

  async requirePermission(
    boardId: number,
    userId: number,
    permission: BoardPermission,
  ): Promise<boolean> {
    // ---------------------------------------
    // Check System Role first
    // ---------------------------------------
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
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
        workspace: {
          select: {
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

    // Workspace role takes precedence

    console.log({
      boardRole,
      workspaceRole,
    });
    if (
      workspaceRole &&
      WORKSPACE_ROLE_PERMISSIONS[workspaceRole]?.includes(permission)
    ) {
      return true;
    }

    // Then board-specific permissions
    if (boardRole && BOARD_ROLE_PERMISSIONS[boardRole]?.includes(permission)) {
      return true;
    }

    throw new ForbiddenException(
      "You don't have permission to perform this action.",
    );
  }
}
