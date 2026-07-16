import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { UserRole } from '@repo/shared';

@Injectable()
export class BoardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireViewer(boardId: number, userId: number) {
    const isMember = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId,
        board: {
          workspace: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      },
      include: {
        board: {
          include: {
            workspace: true,
          },
        },
      },
    });
    return isMember;
  }

  async requireEditor(boardId: number, userId: number) {
    const user = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId,
        board: {
          workspace: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      },
      select: {
        board: {
          select: {
            id: true,
            workspaceId: true,
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
          },
        },
      },
    });

    const workspaceRole = user?.board.workspace.members[0]?.role;

    if (
      workspaceRole !== UserRole.OWNER &&
      workspaceRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        "You don't have permission to edit this board.",
      );
    }
    return true;
  }

  // async requireOwner(workspaceId: number, boardId: number, userId: number) {
  //   const access = await this.requireViewer(workspaceId, boardId, userId);

  //   if (access.workspaceMembership.role !== UserRole.OWNER) {
  //     throw new ForbiddenException(
  //       'Only the board owner can perform this action.',
  //     );
  //   }

  //   return access;
  // }
}
