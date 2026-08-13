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
    const owner = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId,
        role: BoardMemberRole.OWNER,
      },
    });

    if (!owner) {
      throw new ForbiddenException(
        'Only the board owner can manage column permissions.',
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

    return this.prisma.boardColumn.update({
      where: {
        id: columnId,
      },
      data: {
        accessControlEnabled: dto.enabled,
      },
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
        role: BoardMemberRole.OWNER,
      },
    });

    if (!owner) {
      throw new ForbiddenException(
        'Only the board owner can manage column permissions.',
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
        role: BoardMemberRole.OWNER,
      },
    });

    if (!owner) {
      throw new ForbiddenException(
        'Only the board owner can manage column permissions.',
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
