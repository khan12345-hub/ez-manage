import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsAccessService: BoardAccessService,
  ) {}
  async create(createTaskDto: CreateTaskDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: {
          id: createTaskDto.groupId,
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      const lastTask = await tx.task.findFirst({
        where: {
          groupId: createTaskDto.groupId,
        },
        orderBy: {
          order: 'desc',
        },
      });

      const order = lastTask ? lastTask.order + 1 : 1;

      const task = await tx.task.create({
        data: {
          groupId: createTaskDto.groupId,
          createdById: userId,
          name: createTaskDto.name,
          order,
        },
      });

      return task;
    });
  }
  async findOne(taskId: number, userId: number) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            boardId: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        cells: {
          include: {
            column: {
              select: {
                id: true,
                name: true,
                type: true,
                order: true,
              },
            },
          },
          orderBy: {
            column: {
              order: 'asc',
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    // Verifies both workspace and board access
    await this.boardsAccessService.requireViewer(task.group.boardId, userId);

    return task;
  }
    async reorder(dto: any) {
    const dragged = await this.prisma.task.findUnique({
      where: { id: dto.draggedTaskId },
    });

    if (!dragged) throw new NotFoundException('Dragged task not found');

    const target = dto.targetTaskId
      ? await this.prisma.task.findUnique({
          where: { id: dto.targetTaskId },
        })
      : null;

    await this.prisma.$transaction(async (tx) => {
      if (target) {
        if (dragged.groupId === target.groupId) {
          if (dragged.order < target.order) {
            // moving down in the same group: decrement tasks between dragged.order and target.order
            await tx.task.updateMany({
              where: {
                groupId: dragged.groupId,
                order: {
                  gt: dragged.order,
                  lte: target.order,
                },
              },
              data: {
                order: {
                  decrement: 1,
                },
              },
            });
          } else if (dragged.order > target.order) {
            // moving up in the same group: increment tasks between target.order and dragged.order
            await tx.task.updateMany({
              where: {
                groupId: dragged.groupId,
                order: {
                  gte: target.order,
                  lt: dragged.order,
                },
              },
              data: {
                order: {
                  increment: 1,
                },
              },
            });
          }

          await tx.task.update({
            where: { id: dragged.id },
            data: { order: target.order },
          });
        } else {
          // moving to a different group (targeting a task in that group)
          // 1. Close the gap in source group
          await tx.task.updateMany({
            where: {
              groupId: dragged.groupId,
              order: {
                gt: dragged.order,
              },
            },
            data: {
              order: {
                decrement: 1,
              },
            },
          });

          // 2. Make room in destination group
          await tx.task.updateMany({
            where: {
              groupId: dto.destinationGroupId,
              order: {
                gte: target.order,
              },
            },
            data: {
              order: {
                increment: 1,
              },
            },
          });

          // 3. Move the task
          await tx.task.update({
            where: { id: dragged.id },
            data: {
              groupId: dto.destinationGroupId,
              order: target.order,
            },
          });
        }
      } else {
        // moving to a different group (no target task - empty group or end of group)
        // 1. Close the gap in source group
        await tx.task.updateMany({
          where: {
            groupId: dragged.groupId,
            order: {
              gt: dragged.order,
            },
          },
          data: {
            order: {
              decrement: 1,
            },
          },
        });

        // 2. Find max order in destination group
        const maxTask = await tx.task.findFirst({
          where: { groupId: dto.destinationGroupId },
          orderBy: { order: 'desc' },
        });

        const newOrder = maxTask ? maxTask.order + 1 : 1;

        // 3. Move the task
        await tx.task.update({
          where: { id: dragged.id },
          data: {
            groupId: dto.destinationGroupId,
            order: newOrder,
          },
        });
      }
    });
  }

  async update(taskId: number, dto: UpdateTaskDto, userId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        group: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.boardsAccessService.requireViewer(task.group.boardId, userId);

    return this.prisma.task.update({
      where: {
        id: taskId,
      },
      data: dto,
    });
  }

  async remove(taskId: number, userId: number) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        group: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.boardsAccessService.requireViewer(task.group.boardId, userId);

    await this.prisma.task.delete({
      where: {
        id: taskId,
      },
    });

    return {
      message: 'Task deleted successfully.',
    };
  }


}
