import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { BoardMemberRole, BoardColumnType } from 'generated/prisma/enums';

@Injectable()
export class GuestAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAdminOrOwner(boardId: number, userId: number) {
    const member = await this.prisma.boardMember.findFirst({
      where: { boardId, userId },
      select: { role: true },
    });
    const isOwnerOrAdmin =
      member?.role === BoardMemberRole.OWNER ||
      member?.role === BoardMemberRole.ADMIN;

    if (!isOwnerOrAdmin) {
      const ws = await this.prisma.board.findUnique({
        where: { id: boardId },
        select: { workspace: { select: { members: { where: { userId }, select: { role: true } } } } },
      });
      const wsRole = ws?.workspace?.members?.[0]?.role;
      if (wsRole !== 'OWNER' && wsRole !== 'ADMIN') {
        throw new ForbiddenException('Only board admins can manage guest access');
      }
    }
  }

  async generateToken(boardId: number, userId: number) {
    await this.assertAdminOrOwner(boardId, userId);

    const token = randomBytes(24).toString('hex');
    await this.prisma.board.update({
      where: { id: boardId },
      data: { guestToken: token },
    });
    return { token };
  }

  async revokeToken(boardId: number, userId: number) {
    await this.assertAdminOrOwner(boardId, userId);
    await this.prisma.board.update({
      where: { id: boardId },
      data: { guestToken: null },
    });
    return { revoked: true };
  }

  async getToken(boardId: number, userId: number) {
    await this.assertAdminOrOwner(boardId, userId);
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { guestToken: true },
    });
    if (!board) throw new NotFoundException('Board not found');
    return { token: board.guestToken ?? null };
  }

  async getBoardByToken(token: string) {
    const board = await this.prisma.board.findFirst({
      where: { guestToken: token },
      select: {
        id: true,
        name: true,
        columns: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
            isPrimary: true,
            statusOptions: {
              where: { isArchived: false },
              orderBy: { order: 'asc' },
              select: { id: true, label: true, color: true },
            },
          },
        },
        groups: {
          where: { isArchived: false },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            color: true,
            tasks: {
              where: { parentId: null },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                cells: {
                  select: {
                    columnId: true,
                    value: true,
                    column: {
                      select: { id: true, type: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!board) throw new NotFoundException('Invalid or expired guest link');
    return board;
  }
}
