import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { UpdateColumnAccessDto } from './dto/update-column-access.dto';
import { BoardMemberRole } from 'generated/prisma/enums';
import { UpdateColumnPermissionDto } from './dto/update-column-permission.dto';
@Injectable()
export class ColumnsAccessService {
  constructor(private readonly prisma: PrismaService) {}

async updateColumnAccess(
  boardId: number,
  columnId: number,
  dto: UpdateColumnAccessDto,
  userId: number,
) {
  const member = await this.prisma.boardMember.findFirst({
    where: {
      boardId,
      userId,
      role: { in: [BoardMemberRole.OWNER, BoardMemberRole.ADMIN] },
    },
  });

  if (!member) {
    throw new ForbiddenException(
      "Only board owners and admins can manage column permissions.",
    );
  }

  const column = await this.prisma.boardColumn.findFirst({
    where: {
      id: columnId,
      boardId,
    },
  });

  if (!column) {
    throw new NotFoundException("Column not found for this board.");
  }

  return this.prisma.$transaction(async (tx) => {
    const updatedColumn = await tx.boardColumn.update({
      where: { id: columnId },
      data: { accessControlEnabled: dto.enabled },
    });

    if (dto.enabled) {
      // Protection enabled: auto-whitelist the person who enabled it
      await tx.boardColumnPermission.upsert({
        where: { columnId_userId: { columnId, userId } },
        create: { columnId, userId, canEdit: true },
        update: { canEdit: true },
      });
    } else {
      // Protection disabled: clear all permission records → everyone can edit (default)
      await tx.boardColumnPermission.deleteMany({ where: { columnId } });
    }

    return updatedColumn;
  });
}
  async updateColumnPermission(
    boardId: number,
    columnId: number,
    dto: UpdateColumnPermissionDto,
    userId: number,
  ) {
    const owner = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId,
        role: { in: [BoardMemberRole.OWNER, BoardMemberRole.ADMIN] },
      },
    });

    if (!owner) {
      throw new ForbiddenException(
        'Only board owners and admins can manage column permissions.',
      );
    }

    const column = await this.prisma.boardColumn.findFirst({
      where: {
        id: columnId,
        boardId,
      },
    });

    if (!column) {
      throw new NotFoundException('Column not found for this board.');
    }

    const member = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId: dto.userId,
      },
    });

    if (!member) {
      throw new BadRequestException('User is not a member of this board.');
    }

    return this.prisma.boardColumnPermission.upsert({
      where: {
        columnId_userId: {
          columnId,
          userId: dto.userId,
        },
      },
      create: {
        columnId,
        userId: dto.userId,
        canEdit: dto.canEdit,
      },
      update: {
        canEdit: dto.canEdit,
      },
    });
  }
  async removeColumnPermission(
    boardId: number,
    columnId: number,
    targetUserId: number,
    userId: number,
  ) {
    const owner = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId,
        role: { in: [BoardMemberRole.OWNER, BoardMemberRole.ADMIN] },
      },
    });

    if (!owner) {
      throw new ForbiddenException(
        'Only board owners and admins can manage column permissions.',
      );
    }

    const column = await this.prisma.boardColumn.findFirst({
      where: {
        id: columnId,
        boardId,
      },
    });

    if (!column) {
      throw new NotFoundException('Column not found for this board.');
    }

    await this.prisma.boardColumnPermission.delete({
      where: {
        columnId_userId: {
          columnId,
          userId: targetUserId,
        },
      },
    });

    return {
      success: true,
    };
  }
}
