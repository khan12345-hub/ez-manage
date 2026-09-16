import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/enums';

import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ReorderGroupDto } from './dto/reorder-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(
    createGroupDto: CreateGroupDto,
    userId: number,
    boardId: number,
  ) {
    const ORDER_GAP = 1000;

    return this.prisma.$transaction(async (tx) => {
      // const existing = await tx.group.findFirst({
      //   where: {
      //     boardId,
      //     name: createGroupDto.name,
      //   },
      // });

      // if (existing) {
      //   throw new ConflictException(
      //     'Group with this name already exists.',
      //   );
      // }

      const lastGroup = await tx.group.findFirst({
        where: {
          boardId,
        },
        orderBy: {
          order: 'desc',
        },
      });

      const group = await tx.group.create({
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

      await this.activityLogsService.log({
        boardId,
        groupId: group.id,
        userId,
        entityType: ActivityEntityType.GROUP,
        entityId: group.id,
        action: ActivityAction.CREATED,
        metadata: { groupName: group.name },
      }, tx);

      return group;
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

      const updated = await tx.group.update({
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

          ...(updateGroupDto.isArchived !== undefined && {
            isArchived: updateGroupDto.isArchived,
          }),

          updatedById: userId,
        },
      });

      await this.activityLogsService.log({
        boardId,
        groupId: id,
        userId,
        entityType: ActivityEntityType.GROUP,
        entityId: id,
        action: ActivityAction.UPDATED,
        metadata: {
          groupName: group.name,
          ...(updateGroupDto.name !== undefined ? { oldName: group.name, newName: updateGroupDto.name } : {}),
          ...(updateGroupDto.isArchived !== undefined ? { isArchived: updateGroupDto.isArchived } : {}),
        },
      }, tx);

      return updated;
    });
  }

  async duplicate(
    groupId: number,
    boardId: number,
    userId: number,
    withUpdates: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sourceGroup = await tx.group.findFirst({
        where: { id: groupId, boardId },
        include: {
          tasks: {
            where: { parentId: null },
            orderBy: { order: 'asc' },
            include: {
              cells: true,
              subtasks: {
                orderBy: { order: 'asc' },
                include: { cells: true },
              },
              ...(withUpdates
                ? {
                    comments: {
                      where: { parentId: null },
                      orderBy: { createdAt: 'asc' },
                      select: {
                        content: true,
                        userId: true,
                      },
                    },
                  }
                : {}),
            },
          },
        },
      });

      if (!sourceGroup) {
        throw new NotFoundException('Group not found for the specified board.');
      }

      const lastGroup = await tx.group.findFirst({
        where: { boardId },
        orderBy: { order: 'desc' },
      });

      const newGroup = await tx.group.create({
        data: {
          boardId,
          name: `${sourceGroup.name} (Copy)`,
          color: sourceGroup.color,
          createdById: userId,
          order: lastGroup ? lastGroup.order + 1000 : 1000,
        },
      });

      for (const task of sourceGroup.tasks) {
        const newTask = await tx.task.create({
          data: {
            name: task.name,
            groupId: newGroup.id,
            createdById: userId,
            order: task.order,
          },
        });

        for (const cell of task.cells) {
          await tx.taskCell.create({
            data: {
              taskId: newTask.id,
              columnId: cell.columnId,
              value: cell.value as any,
            },
          });
        }

        for (const subtask of task.subtasks) {
          const newSubtask = await tx.task.create({
            data: {
              name: subtask.name,
              groupId: newGroup.id,
              parentId: newTask.id,
              createdById: userId,
              order: subtask.order,
            },
          });

          for (const cell of subtask.cells) {
            await tx.taskCell.create({
              data: {
                taskId: newSubtask.id,
                columnId: cell.columnId,
                value: cell.value as any,
              },
            });
          }
        }

        if (withUpdates && (task as any).comments) {
          for (const comment of (task as any).comments) {
            await tx.taskComment.create({
              data: {
                taskId: newTask.id,
                content: comment.content,
                userId: comment.userId,
              },
            });
          }
        }
      }

      await this.activityLogsService.log({
        boardId,
        groupId: newGroup.id,
        userId,
        entityType: ActivityEntityType.GROUP,
        entityId: newGroup.id,
        action: ActivityAction.CREATED,
        metadata: { groupName: newGroup.name, duplicatedFrom: sourceGroup.name },
      }, tx);

      return newGroup;
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

      // Log before delete so group name is still in metadata; no groupId to avoid cascade deletion of log
      await this.activityLogsService.log({
        boardId,
        userId,
        entityType: ActivityEntityType.GROUP,
        entityId: id,
        action: ActivityAction.DELETED,
        metadata: { groupName: group.name },
      }, tx);

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

  async findArchived(boardId: number) {
    return this.prisma.group.findMany({
      where: {
        boardId,
        isArchived: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        color: true,
        updatedAt: true,
        _count: {
          select: { tasks: true },
        },
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