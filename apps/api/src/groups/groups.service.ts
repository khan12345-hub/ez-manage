import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ReorderGroupDto } from './dto/reorder-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createGroupDto: CreateGroupDto,
    userId: number,
    boardId: number,
  ) {
    const ORDER_GAP = 1000;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.group.findFirst({
        where: {
          boardId,
          name: createGroupDto.name,
        },
      });

      if (existing) {
        throw new ConflictException(
          'Group with this name already exists.',
        );
      }

      const lastGroup = await tx.group.findFirst({
        where: {
          boardId,
        },
        orderBy: {
          order: 'desc',
        },
      });

      return tx.group.create({
        data: {
          boardId,
          name: createGroupDto.name,
          color: createGroupDto.color,
          createdById: userId,
          order: lastGroup
            ? lastGroup.order + ORDER_GAP
            : ORDER_GAP,
        },
      });
    });
  }

  async update(
    id: number,
    updateGroupDto: UpdateGroupDto,
    userId: number,
    boardId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirst({
        where: {
          id,
          boardId,
        },
      });

      if (!group) {
        throw new NotFoundException(
          'Group not found for the specified board.',
        );
      }

      if (
        updateGroupDto.name !== undefined &&
        updateGroupDto.name !== group.name
      ) {
        const existing = await tx.group.findFirst({
          where: {
            boardId,
            name: updateGroupDto.name,
            NOT: {
              id,
            },
          },
        });

        if (existing) {
          throw new ConflictException(
            'Group with this name already exists.',
          );
        }
      }

      return tx.group.update({
        where: {
          id,
        },
        data: {
          ...(updateGroupDto.name !== undefined && {
            name: updateGroupDto.name,
          }),

          ...(updateGroupDto.color !== undefined && {
            color: updateGroupDto.color,
          }),

          updatedById: userId,
        },
      });
    });
  }

  async remove(
    id: number,
    boardId: number,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirst({
        where: {
          id,
          boardId,
        },
      });

      if (!group) {
        throw new NotFoundException(
          'Group not found for the specified board.',
        );
      }

      await tx.group.delete({
        where: {
          id,
        },
      });

      return {
        message: 'Group deleted successfully.',
      };
    });
  }

  async reorder(
    dto: ReorderGroupDto,
    userId: number,
    boardId: number,
  ) {
    const group = await this.prisma.group.findFirst({
      where: {
        id: dto.groupId,
        boardId,
      },
    });

    if (!group) {
      throw new NotFoundException(
        'Group not found for the specified board.',
      );
    }

    const [previousGroup, nextGroup] =
      await Promise.all([
        dto.previousGroupId
          ? this.prisma.group.findFirst({
              where: {
                id: dto.previousGroupId,
                boardId,
              },
            })
          : Promise.resolve(null),

        dto.nextGroupId
          ? this.prisma.group.findFirst({
              where: {
                id: dto.nextGroupId,
                boardId,
              },
            })
          : Promise.resolve(null),
      ]);

    let newOrder: number;

    // Only group in board / no surrounding groups
    if (!previousGroup && !nextGroup) {
      newOrder = 1000;
    }

    // Move to beginning
    else if (!previousGroup && nextGroup) {
      newOrder = nextGroup.order - 1000;
    }

    // Move to end
    else if (previousGroup && !nextGroup) {
      newOrder = previousGroup.order + 1000;
    }

    // Move between two groups
    else {
      newOrder =
        (previousGroup!.order + nextGroup!.order) / 2;
    }

    await this.prisma.group.update({
      where: {
        id: dto.groupId,
      },
      data: {
        order: newOrder,
        updatedById: userId,
      },
    });

    return {
      message: 'Group reordered successfully.',
    };
  }

  async findAll(boardId: number) {
    return this.prisma.group.findMany({
      where: {
        boardId,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findOne(
    id: number,
    boardId: number,
  ) {
    const group = await this.prisma.group.findFirst({
      where: {
        id,
        boardId,
      },
    });

    if (!group) {
      throw new NotFoundException(
        'Group not found for the specified board.',
      );
    }

    return group;
  }
}