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
    return isMember
  }

  // async requireEditor(workspaceId: number, boardId: number, userId: number) {
  //   const access = await this.requireViewer(workspaceId, boardId, userId);

  //   if (
  //     access.workspaceMembership.role !== UserRole.OWNER &&
  //     access.workspaceMembership.role !== UserRole.ADMIN
  //   ) {
  //     throw new ForbiddenException(
  //       "You don't have permission to edit this board.",
  //     );
  //   }

  //   return access;
  // }

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
